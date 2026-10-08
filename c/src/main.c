// Гастрогид — веб-сервер на C.
// Отдаёт HTML-страницы, JSON-API, картинки и делает редиректы со старых адресов WordPress.
//
// Сборка (Windows, MinGW):  gcc -O2 -o gastroguia.exe c/src/*.c -lws2_32
// Сборка (Linux/macOS):     gcc -O2 -o gastroguia c/src/*.c
// Запуск из корня проекта:  gastroguia  →  http://localhost:8080
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
typedef SOCKET sock_t;
#define close_sock closesocket
#define SOCK_INVALID INVALID_SOCKET
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
typedef int sock_t;
#define close_sock close
#define SOCK_INVALID (-1)
#endif

#include "buf.h"
#include "i18n.h"
#include "pages.h"
#include "site.h"

#define MAX_REQUEST 8192
#define MAX_PARAMS 32

typedef struct {
    const char *data_path, *public_dir, *static_dir, *host;
    int port;
} Config;

static Site SITE;
static Config CFG = {"content/dishes.json", "public", "c/static", "127.0.0.1", 8080};

/* --- разбор запроса --- */

typedef struct {
    char key[64];
    char value[512];
} Param;

typedef struct {
    char method[8];
    char path[1024];      /* декодированный путь */
    char raw_query[2048]; /* как пришёл, для редиректов */
    Param params[MAX_PARAMS];
    int nparams;
} Request;

static int hexval(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

/* %XX и «+» → байты. 0 — ошибка: битая последовательность, нулевой байт или переполнение */
static int url_decode(const char *s, size_t len, char *out, size_t outlen, int plus_is_space) {
    size_t n = 0;
    for (size_t i = 0; i < len; i++) {
        char c = s[i];
        if (c == '%') {
            if (i + 2 >= len) return 0;
            int h = hexval(s[i + 1]), l = hexval(s[i + 2]);
            if (h < 0 || l < 0) return 0;
            c = (char)(h * 16 + l);
            i += 2;
        } else if (c == '+' && plus_is_space) c = ' ';
        if (c == '\0' || n + 1 >= outlen) return 0;
        out[n++] = c;
    }
    out[n] = '\0';
    return 1;
}

static int parse_request(const char *raw, Request *r) {
    memset(r, 0, sizeof *r);
    const char *sp1 = strchr(raw, ' ');
    if (!sp1 || sp1 - raw >= (long)sizeof r->method) return 0;
    memcpy(r->method, raw, (size_t)(sp1 - raw));
    const char *target = sp1 + 1;
    const char *sp2 = strchr(target, ' ');
    const char *eol = strstr(target, "\r\n");
    if (!sp2 || !eol || sp2 > eol || *target != '/') return 0;
    const char *q = memchr(target, '?', (size_t)(sp2 - target));
    const char *path_end = q ? q : sp2;
    if (!url_decode(target, (size_t)(path_end - target), r->path, sizeof r->path, 0)) return 0;
    if (q) {
        size_t qlen = (size_t)(sp2 - q - 1);
        if (qlen >= sizeof r->raw_query) return 0;
        memcpy(r->raw_query, q + 1, qlen);
        r->raw_query[qlen] = '\0';
        const char *p = r->raw_query;
        while (*p && r->nparams < MAX_PARAMS) {
            const char *amp = strchr(p, '&');
            size_t plen = amp ? (size_t)(amp - p) : strlen(p);
            const char *eq = memchr(p, '=', plen);
            Param *pr = &r->params[r->nparams];
            size_t klen = eq ? (size_t)(eq - p) : plen;
            if (klen && url_decode(p, klen, pr->key, sizeof pr->key, 1) &&
                url_decode(eq ? eq + 1 : "", eq ? plen - klen - 1 : 0, pr->value, sizeof pr->value, 1))
                r->nparams++;
            if (!amp) break;
            p = amp + 1;
        }
    }
    /* /dishes/plov/ и /dishes/plov — один и тот же адрес */
    size_t pl = strlen(r->path);
    while (pl > 1 && r->path[pl - 1] == '/') r->path[--pl] = '\0';
    return 1;
}

static const char *param(const Request *r, const char *key) {
    for (int i = 0; i < r->nparams; i++)
        if (!strcmp(r->params[i].key, key)) return r->params[i].value;
    return NULL;
}

/* --- ответ --- */

static void send_all(sock_t s, const char *p, size_t n) {
    while (n > 0) {
#if defined(_WIN32)
        int w = send(s, p, (int)(n > 65536 ? 65536 : n), 0);
#elif defined(MSG_NOSIGNAL)
        ssize_t w = send(s, p, n, MSG_NOSIGNAL);
#else
        ssize_t w = send(s, p, n, 0);
#endif
        if (w <= 0) return;
        p += w;
        n -= (size_t)w;
    }
}

static const char *status_text(int code) {
    switch (code) {
    case 200: return "OK";
    case 301: return "Moved Permanently";
    case 400: return "Bad Request";
    case 404: return "Not Found";
    case 405: return "Method Not Allowed";
    default: return "Internal Server Error";
    }
}

static void respond(sock_t s, const Request *r, int code, const char *type, const char *cache, const char *body, size_t len,
                    const char *location) {
    Buf h = {0};
    buf_printf(&h, "HTTP/1.1 %d %s\r\n", code, status_text(code));
    if (type) buf_printf(&h, "Content-Type: %s\r\n", type);
    buf_printf(&h, "Content-Length: %lu\r\n", (unsigned long)len);
    if (location) buf_printf(&h, "Location: %s\r\n", location);
    if (cache) buf_printf(&h, "Cache-Control: %s\r\n", cache);
    buf_puts(&h, "X-Content-Type-Options: nosniff\r\nReferrer-Policy: strict-origin-when-cross-origin\r\nConnection: close\r\n\r\n");
    send_all(s, h.p, h.n);
    if (r && strcmp(r->method, "HEAD") && body) send_all(s, body, len);
    buf_free(&h);
    printf("%s %s%s%s -> %d\n", r ? r->method : "?", r ? r->path : "?", r && *r->raw_query ? "?" : "",
           r ? r->raw_query : "", code);
    fflush(stdout);
}

static void respond_buf(sock_t s, const Request *r, int code, const char *type, Buf *b) {
    respond(s, r, code, type, "no-cache", b->p, b->n, NULL);
}

static void redirect(sock_t s, const Request *r, const char *to) {
    Buf loc = {0};
    buf_puts(&loc, to);
    /* Параметры старого адреса (например, ?lang=en) переносим на новый */
    if (*r->raw_query) buf_printf(&loc, "%c%s", strchr(to, '?') ? '&' : '?', r->raw_query);
    respond(s, r, 301, "text/plain; charset=utf-8", "public, max-age=86400", "", 0, loc.p);
    buf_free(&loc);
}

static void not_found(sock_t s, const Request *r, Lang lang) {
    Buf b = {0};
    page_not_found(&b, lang);
    respond_buf(s, r, 404, "text/html; charset=utf-8", &b);
    buf_free(&b);
}

/* --- файлы --- */

static const char *mime(const char *path) {
    const char *dot = strrchr(path, '.');
    if (!dot) return "application/octet-stream";
    static const struct {
        const char *ext, *type;
    } T[] = {
        {".html", "text/html; charset=utf-8"}, {".css", "text/css; charset=utf-8"}, {".js", "text/javascript; charset=utf-8"},
        {".json", "application/json"},         {".svg", "image/svg+xml"},          {".png", "image/png"},
        {".jpg", "image/jpeg"},                {".jpeg", "image/jpeg"},            {".webp", "image/webp"},
        {".gif", "image/gif"},                 {".ico", "image/x-icon"},           {".woff2", "font/woff2"},
        {".woff", "font/woff"},                {".ttf", "font/ttf"},               {".txt", "text/plain; charset=utf-8"},
    };
    for (size_t i = 0; i < sizeof T / sizeof *T; i++) {
        const char *a = dot, *b = T[i].ext;
        while (*a && *b && (*a | 32) == *b) a++, b++;
        if (!*a && !*b) return T[i].type;
    }
    return "application/octet-stream";
}

/* Путь безопасен, если в нём нет «..», обратных слэшей, двоеточий и скрытых файлов */
static int safe_path(const char *p) {
    if (*p != '/') return 0;
    for (const char *s = p; *s; s++) {
        if (*s == '\\' || *s == ':') return 0;
        if (*s == '/' && s[1] == '.') return 0;
    }
    return 1;
}

static int serve_file(sock_t s, const Request *r, const char *root, const char *rel, const char *cache) {
    if (!safe_path(rel)) return 0;
    char full[2048];
    if (snprintf(full, sizeof full, "%s%s", root, rel) >= (int)sizeof full) return 0;
    struct stat st;
    if (stat(full, &st) != 0 || !S_ISREG(st.st_mode)) return 0;
    FILE *f = fopen(full, "rb");
    if (!f) return 0;
    Buf b = {0};
    char chunk[65536];
    size_t n;
    while ((n = fread(chunk, 1, sizeof chunk, f)) > 0) buf_put(&b, chunk, n);
    fclose(f);
    respond(s, r, 200, mime(rel), cache, b.p ? b.p : "", b.n, NULL);
    buf_free(&b);
    return 1;
}

/* --- маршруты --- */

static int valid_slug(const char *s) {
    if (!*s || strlen(s) > 120) return 0;
    for (; *s; s++)
        if (!((*s >= 'a' && *s <= 'z') || (*s >= '0' && *s <= '9') || *s == '-')) return 0;
    return 1;
}

static int starts(const char *s, const char *prefix, const char **rest) {
    size_t n = strlen(prefix);
    if (strncmp(s, prefix, n)) return 0;
    *rest = s + n;
    return 1;
}

static Filter filter_from(const Request *r) {
    Filter f = {param(r, "q"), param(r, "cuisine"), param(r, "course"), 0, 0, 0};
    f.no_gluten = param(r, "no_gluten") != NULL;
    f.no_lactose = param(r, "no_lactose") != NULL;
    f.no_sugar = param(r, "no_sugar") != NULL;
    return f;
}

static void handle(sock_t s, const char *raw) {
    Request r;
    if (!parse_request(raw, &r)) {
        respond(s, NULL, 400, "text/plain; charset=utf-8", NULL, "Bad Request", 11, NULL);
        return;
    }
    if (strcmp(r.method, "GET") && strcmp(r.method, "HEAD")) {
        respond(s, &r, 405, "text/plain; charset=utf-8", NULL, "Method Not Allowed", 18, NULL);
        return;
    }
    Lang lang = lang_parse(param(&r, "lang"));
    const char *rest;
    Buf b = {0};

    if (!strcmp(r.path, "/")) {
        page_home(&b, &SITE, lang);
        respond_buf(s, &r, 200, "text/html; charset=utf-8", &b);
    } else if (!strcmp(r.path, "/dishes")) {
        Filter f = filter_from(&r);
        page_catalog(&b, &SITE, lang, &f);
        respond_buf(s, &r, 200, "text/html; charset=utf-8", &b);
    } else if (starts(r.path, "/dishes/", &rest) && valid_slug(rest)) {
        if (page_dish(&b, &SITE, lang, rest)) respond_buf(s, &r, 200, "text/html; charset=utf-8", &b);
        else not_found(s, &r, lang);
    } else if (!strcmp(r.path, "/api/dishes")) {
        Filter f = filter_from(&r);
        api_dishes(&b, &SITE, lang, &f);
        respond_buf(s, &r, 200, "application/json; charset=utf-8", &b);
    } else if (starts(r.path, "/api/dishes/", &rest) && valid_slug(rest) && api_dish(&b, &SITE, rest)) {
        respond_buf(s, &r, 200, "application/json; charset=utf-8", &b);
    } else if (starts(r.path, "/static/", &rest)) {
        /* rest - 1 указывает на «/» перед именем файла */
        if (!serve_file(s, &r, CFG.static_dir, rest - 1, "public, max-age=300")) not_found(s, &r, lang);
    } else {
        /* Старые адреса WordPress */
        for (size_t i = 0; i < SITE.nredirects; i++)
            if (!strcmp(SITE.redirects[i].source, r.path)) {
                redirect(s, &r, SITE.redirects[i].destination);
                return;
            }
        Buf to = {0};
        if (!strcmp(r.path, "/bliuda")) redirect(s, &r, "/dishes");
        else if (starts(r.path, "/bliuda/", &rest) && valid_slug(rest)) {
            buf_printf(&to, "/dishes/%s", rest);
            redirect(s, &r, to.p);
        } else if (starts(r.path, "/kukhnia/", &rest) && valid_slug(rest)) {
            buf_printf(&to, "/dishes?cuisine=%s", rest);
            redirect(s, &r, to.p);
        } else if (!serve_file(s, &r, CFG.public_dir, r.path, "public, max-age=86400")) not_found(s, &r, lang);
        buf_free(&to);
    }
    buf_free(&b);
}

/* --- сервер --- */

static void read_and_handle(sock_t c) {
#ifdef _WIN32
    DWORD tv = 5000;
#else
    struct timeval tv = {5, 0};
#endif
    setsockopt(c, SOL_SOCKET, SO_RCVTIMEO, (const char *)&tv, sizeof tv);
    char req[MAX_REQUEST + 1];
    size_t n = 0;
    while (n < MAX_REQUEST) {
        int got = (int)recv(c, req + n, (int)(MAX_REQUEST - n), 0);
        if (got <= 0) break;
        n += (size_t)got;
        req[n] = '\0';
        if (strstr(req, "\r\n\r\n")) break;
    }
    req[n] = '\0';
    if (n && strstr(req, "\r\n")) handle(c, req);
    else if (n) respond(c, NULL, 400, "text/plain; charset=utf-8", NULL, "Bad Request", 11, NULL);
}

static void usage(const char *prog) {
    printf("Использование: %s [-p порт] [-H адрес] [-d content/dishes.json] [-r public] [-s c/static]\n", prog);
}

int main(int argc, char **argv) {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        fputs("Не удалось запустить сеть (WSAStartup)\n", stderr);
        return 1;
    }
#else
    signal(SIGPIPE, SIG_IGN);
#endif
    for (int i = 1; i < argc; i++) {
        const char *a = argv[i];
        const char *v = i + 1 < argc ? argv[i + 1] : NULL;
        if (!strcmp(a, "-h") || !strcmp(a, "--help")) { usage(argv[0]); return 0; }
        if (!v) { usage(argv[0]); return 1; }
        if (!strcmp(a, "-p")) CFG.port = atoi(v);
        else if (!strcmp(a, "-H")) CFG.host = v;
        else if (!strcmp(a, "-d")) CFG.data_path = v;
        else if (!strcmp(a, "-r")) CFG.public_dir = v;
        else if (!strcmp(a, "-s")) CFG.static_dir = v;
        else { usage(argv[0]); return 1; }
        i++;
    }
    if (CFG.port <= 0 || CFG.port > 65535) {
        fputs("Неверный порт\n", stderr);
        return 1;
    }
    if (!site_load(&SITE, CFG.data_path)) return 1;

    sock_t srv = socket(AF_INET, SOCK_STREAM, 0);
    if (srv == SOCK_INVALID) {
        fputs("Не удалось создать сокет\n", stderr);
        return 1;
    }
    int yes = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, (const char *)&yes, sizeof yes);
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof addr);
    addr.sin_family = AF_INET;
    addr.sin_port = htons((unsigned short)CFG.port);
    if (inet_pton(AF_INET, CFG.host, &addr.sin_addr) != 1) {
        fprintf(stderr, "Неверный адрес %s\n", CFG.host);
        return 1;
    }
    if (bind(srv, (struct sockaddr *)&addr, sizeof addr) != 0 || listen(srv, 64) != 0) {
        fprintf(stderr, "Порт %d занят или недоступен. Попробуйте другой: -p 8081\n", CFG.port);
        return 1;
    }
    printf("Гастрогид: блюд %lu, кухонь %lu\nОткройте http://%s:%d  (остановить — Ctrl+C)\n", (unsigned long)SITE.ndishes, (unsigned long)SITE.ncuisines,
           strcmp(CFG.host, "0.0.0.0") ? CFG.host : "localhost", CFG.port);
    fflush(stdout);

    for (;;) {
        sock_t c = accept(srv, NULL, NULL);
        if (c == SOCK_INVALID) continue;
        read_and_handle(c);
        close_sock(c);
    }
}
