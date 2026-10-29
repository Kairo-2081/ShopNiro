const orderItemJson = `json_strip_nulls(json_build_object(
  'Product_ID', item.product_id_snapshot,
  'Name', item.product_name,
  'Price', item.unit_price,
  'Quantity', item.quantity,
  'Image', COALESCE(item.image, ''),
  'Size', NULLIF(item.size, ''),
  'Seller_ID', item.seller_id_snapshot
))`;

export const orderItemsForOrderSql = `COALESCE((
  SELECT json_agg(${orderItemJson} ORDER BY item.order_item_id)
  FROM order_items item
  WHERE item.order_id = o.id
), '[]'::json)`;

export const orderItemsForFulfillmentSql = `COALESCE((
  SELECT json_agg(${orderItemJson} ORDER BY item.order_item_id)
  FROM order_items item
  WHERE item.order_id = sf.order_id
    AND item.seller_id_snapshot = sf.seller_id
), '[]'::json)`;
