<?php
/**
 * Plugin Name: Гастрогид — фото после импорта
 * Description: Один раз проставляет фото в поле JetEngine «foto» у блюд из wordpress/gastroguia-*.xml. Включите после импорта, откройте любую страницу админки и удалите плагин.
 *
 * Импортёр WordPress заново нумерует вложения и сам исправляет только миниатюру записи
 * (_thumbnail_id), а произвольное поле «foto» оставляет со старым номером из файла.
 * Английским версиям (WPML) фото берётся у русской записи.
 */

defined('ABSPATH') || exit;

add_action('admin_init', function () {
    if (!current_user_can('manage_options') || get_option('gastroguia_photos_fixed')) {
        return;
    }
    $ids = get_posts([
        'post_type' => 'bliuda',
        'post_status' => 'any',
        'numberposts' => -1,
        'fields' => 'ids',
        'suppress_filters' => true, // все языки WPML сразу
        'meta_key' => '_wpml_import_translation_group',
    ]);
    $fixed = 0;
    foreach ($ids as $id) {
        $thumb = (int) get_post_thumbnail_id($id);
        if (!$thumb) {
            // Английская версия: берём фото у русской
            $ru = apply_filters('wpml_object_id', $id, 'bliuda', false, 'ru');
            $thumb = $ru && $ru !== $id ? (int) get_post_thumbnail_id($ru) : 0;
            if ($thumb) {
                set_post_thumbnail($id, $thumb);
            }
        }
        if ($thumb && (int) get_post_meta($id, 'foto', true) !== $thumb) {
            update_post_meta($id, 'foto', $thumb);
            $fixed++;
        }
    }
    update_option('gastroguia_photos_fixed', 1, false);
    add_action('admin_notices', function () use ($fixed) {
        printf('<div class="notice notice-success"><p>Гастрогид: фото проставлено у %d блюд. Плагин можно удалить.</p></div>', $fixed);
    });
});
