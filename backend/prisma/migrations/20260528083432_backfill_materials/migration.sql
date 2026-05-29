-- Backfill materials from existing bom_items + boms (link by code).
-- Strategy: MAX(stock) per code (safer than last-wins — avoid underestimating).

-- Ensure there's at least one user to attribute records to (system user id=1 if exists).
SET @sysuser := (SELECT id FROM users ORDER BY id ASC LIMIT 1);

-- Insert from bom_items: code = component_code, take MAX stock.
INSERT INTO materials (code, name, uom, actual_stock, standard_stock, moq, created_at, updated_at, created_by_user_id, updated_by_user_id)
SELECT
  bi.component_code,
  MAX(bi.component_name)        AS name,
  MAX(bi.uom)                   AS uom,
  MAX(bi.actual_stock)          AS actual_stock,
  MAX(bi.standard_stock)        AS standard_stock,
  NULL                          AS moq,
  NOW(), NOW(), @sysuser, @sysuser
FROM bom_items bi
LEFT JOIN materials m ON m.code = bi.component_code
WHERE m.id IS NULL
GROUP BY bi.component_code;

-- Insert top-product codes from boms that aren't already in materials.
INSERT INTO materials (code, name, uom, actual_stock, standard_stock, moq, created_at, updated_at, created_by_user_id, updated_by_user_id)
SELECT
  b.material_code,
  b.material_description,
  'PC',
  0, 0, NULL,
  NOW(), NOW(), @sysuser, @sysuser
FROM boms b
LEFT JOIN materials m ON m.code = b.material_code
WHERE m.id IS NULL;
