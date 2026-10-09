<?php
/**
 * Plugin Name: Гастрогид — после импорта
 * Description: Связывает блюда из wordpress/gastroguia-*.xml с русскими записями в WPML, возвращает адреса без «-2» и проставляет фото. Положите в wp-content/mu-plugins/, откройте админку, после сообщения «готово» удалите.
 *
 * Каждая импортированная запись несёт поля:
 *   _gastroguia_lang     язык записи (ru, en, ja…)
 *   _gastroguia_slug     адрес русской записи на сайте
 *   _gastroguia_ru_ids   у блюд, которые уже были на сайте, — номера их записей (среди них русская)
 * Обработанные записи помечаются _gastroguia_done, поэтому плагин можно держать включённым,
 * пока загружаете файлы по одному: при каждом открытии админки он доделывает новые.
 */

defined('ABSPATH') || exit;

const GASTROGUIA_TYPE = 'bliuda';

function gastroguia_lang_of($id) {
    $code = apply_filters('wpml_element_language_code', null, ['element_id' => $id, 'element_type' => 'post_' . GASTROGUIA_TYPE]);
    return is_string($code) ? $code : null;
}

// Русская запись блюда: импортированная из gastroguia-ru.xml или уже бывшая на сайте
function gastroguia_ru_original($slug, $ru_ids) {
    $ids = $ru_ids ? array_map('intval', explode(',', $ru_ids)) : get_posts([
        'post_type' => GASTROGUIA_TYPE,
        'name' => $slug,
        'post_status' => 'any',
        'numberposts' => -1,
        'fields' => 'ids',
        'suppress_filters' => true, // все языки WPML сразу
    ]);
    foreach ($ids as $id) {
        if (get_post_type($id) !== GASTROGUIA_TYPE) {
            continue;
        }
        $own = get_post_meta($id, '_gastroguia_lang', true);
        if ($own === 'ru' || (!$own && gastroguia_lang_of($id) === 'ru')) {
            return (int) $id;
        }
    }
    return 0;
}

// Фото записи: миниатюра, а у старых блюд — поле JetEngine «foto»
function gastroguia_photo_of($id) {
    $thumb = (int) get_post_thumbnail_id($id);
    return $thumb ?: (int) get_post_meta($id, 'foto', true);
}

add_action('admin_init', function () {
    if (!current_user_can('manage_options')) {
        return;
    }
    $ids = get_posts([
        'post_type' => GASTROGUIA_TYPE,
        'post_status' => 'any',
        'numberposts' => -1,
        'fields' => 'ids',
        'suppress_filters' => true,
        'meta_query' => [
            ['key' => '_gastroguia_lang', 'compare' => 'EXISTS'],
            ['key' => '_gastroguia_done', 'compare' => 'NOT EXISTS'],
        ],
    ]);
    if (!$ids) {
        return;
    }
    // Сначала русские записи: переводы привязываются к ним
    usort($ids, function ($a, $b) {
        return (get_post_meta($a, '_gastroguia_lang', true) !== 'ru') <=> (get_post_meta($b, '_gastroguia_lang', true) !== 'ru');
    });

    $wpml = defined('ICL_SITEPRESS_VERSION');
    $active = $wpml ? array_keys((array) apply_filters('wpml_active_languages', null, ['skip_missing' => 0])) : [];
    $type = 'post_' . GASTROGUIA_TYPE;
    $stats = ['linked' => 0, 'renamed' => 0, 'photos' => 0, 'twice' => 0];
    $missing_langs = [];
    $no_original = [];

    foreach ($ids as $id) {
        $lang = get_post_meta($id, '_gastroguia_lang', true);
        $slug = get_post_meta($id, '_gastroguia_slug', true);
        $ru = 0;

        if ($wpml) {
            if (!in_array($lang, $active, true)) {
                $missing_langs[$lang] = true;
                continue; // доделаем, когда язык добавят в WPML
            }
            if ($lang === 'ru') {
                $trid = apply_filters('wpml_element_trid', null, $id, $type);
                do_action('wpml_set_element_language_details', [
                    'element_id' => $id,
                    'element_type' => $type,
                    'trid' => $trid ?: false,
                    'language_code' => 'ru',
                    'source_language_code' => null,
                ]);
            } else {
                $ru = gastroguia_ru_original($slug, get_post_meta($id, '_gastroguia_ru_ids', true));
                if (!$ru) {
                    $no_original[$slug] = true;
                    continue;
                }
                $trid = apply_filters('wpml_element_trid', null, $ru, $type);
                $existing = (int) apply_filters('wpml_object_id', $ru, GASTROGUIA_TYPE, false, $lang);
                if ($existing && $existing !== (int) $id) {
                    // Перевод на этот язык уже есть — скорее всего, файл загрузили второй раз
                    $stats['twice']++;
                    update_post_meta($id, '_gastroguia_done', 'дубль');
                    continue;
                }
                do_action('wpml_set_element_language_details', [
                    'element_id' => $id,
                    'element_type' => $type,
                    'trid' => $trid,
                    'language_code' => $lang,
                    'source_language_code' => 'ru',
                ]);
                $stats['linked']++;
            }
        }

        // При импорте все записи были русскими, поэтому переводы получили адреса вида kubdari-2.
        // Теперь у них свой язык, и WPML разрешает тот же адрес, что у русской записи.
        if ($slug && get_post_field('post_name', $id) !== $slug) {
            wp_update_post(['ID' => $id, 'post_name' => $slug]);
            if (get_post_field('post_name', $id) === $slug) {
                $stats['renamed']++;
            }
        }

        // Фото: импортёр поправил только миниатюру, а поле «foto» осталось со старым номером из файла.
        // Переводам фото берём у русской записи.
        $photo = gastroguia_photo_of($id);
        if (!$photo && $ru) {
            $photo = gastroguia_photo_of($ru);
            if ($photo) {
                set_post_thumbnail($id, $photo);
            }
        }
        if ($photo && (int) get_post_meta($id, 'foto', true) !== $photo) {
            update_post_meta($id, 'foto', $photo);
            $stats['photos']++;
        }

        update_post_meta($id, '_gastroguia_done', 1);
    }

    add_action('admin_notices', function () use ($stats, $missing_langs, $no_original, $wpml) {
        $lines = [sprintf(
            'Гастрогид: связано переводов %d, исправлено адресов %d, проставлено фото %d.',
            $stats['linked'],
            $stats['renamed'],
            $stats['photos']
        )];
        if (!$wpml) {
            $lines[] = 'WPML не активен — переводы не связаны. Включите WPML и обновите страницу.';
        }
        if ($missing_langs) {
            $lines[] = 'Добавьте языки в WPML → Языки, затем обновите страницу: ' . implode(', ', array_keys($missing_langs)) . '.';
        }
        if ($no_original) {
            $lines[] = 'Не найдена русская запись для: ' . implode(', ', array_keys($no_original)) . ' — сначала загрузите gastroguia-ru.xml.';
        }
        if ($stats['twice']) {
            $lines[] = sprintf('Пропущено повторов %d: перевод на этот язык уже был. Лишние записи можно удалить.', $stats['twice']);
        }
        $done = !$missing_langs && !$no_original;
        if ($done) {
            $lines[] = 'Готово — плагин можно удалить.';
        }
        printf(
            '<div class="notice notice-%s"><p>%s</p></div>',
            $done ? 'success' : 'warning',
            implode('<br>', array_map('esc_html', $lines))
        );
    });
});
