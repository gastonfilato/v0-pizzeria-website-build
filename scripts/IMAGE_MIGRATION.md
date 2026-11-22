# Imágenes de Totore

Preparación para reemplazar las 42 referencias al Blob bloqueado (inventario del 22/11/2026). Los originales todavía no se recuperaron. No desplegar como reparación completa hasta ejecutar y verificar la migración.

Las subidas de productos y banners usan el bucket público `media` que Totore ya utiliza. Requieren una sesión y una fila correspondiente en `admin_users`. El servidor valida el contenido, rechaza animaciones y convierte a WebP con un máximo de 1000 px para productos y 1920 px para banners, preservando la proporción y sin ampliar imágenes pequeñas.

## Recuperar originales

`totore-image-manifest.json` relaciona producto/banner, ID, URL actual y nombre de archivo esperado. Guardar los originales exactos en una carpeta fuera del repositorio con esos nombres. Las imágenes antiguas de `public/images` no cubren el catálogo actual; no utilizarlas como sustitutos sin revisar.

## Verificar antes de aplicar

```sh
node scripts/migrate-images.mjs --sources /ruta/originales
```

Este comando no accede a Supabase ni modifica referencias. Debe encontrar y comprimir los 42 archivos. Comparar visualmente las versiones comprimidas antes de publicar.

## Aplicar

Configurar en el entorno local las variables `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de Totore. Nunca guardar la clave en el repositorio. Confirmar que `media` sea público y permita WebP, y que el administrador real esté registrado en `admin_users`.

```sh
node scripts/migrate-images.mjs --sources /ruta/originales --apply
```

El comando valida que el proyecto sea el de Totore y que ninguna referencia haya cambiado. Guarda un respaldo en `.image-migration`, sube todas las versiones comprimidas y verifica su descarga antes de modificar la base. Las actualizaciones comparan la URL anterior para evitar sobrescribir cambios simultáneos. Si falla una actualización, intenta restaurar las que ya modificó y avisa si alguna necesita intervención. Los archivos anteriores se conservan.

Después de aplicar, verificar home, favoritos, promociones, catálogo y una subida autenticada de producto y banner en preview. Confirmar reducción de tamaño y funcionamiento del administrador antes de desplegar. No migrar Namaka ni Crumbs.
