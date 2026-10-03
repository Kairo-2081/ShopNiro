export interface Address {
  Street: string;
  House_Name: string;
  City: string;
  Postal_Code: string;
  Additional_Info?: string;
  Latitude?: number;
  Longitude?: number;
}

export interface Customer {
  Customer_ID: string;
  Username?: string;
  Name: string;
  Email: string;
  Password?: string;
  Number: string;
  Address: Address;
}

export interface Admin {
  Admin_ID: string;
  Username?: string;
  Name: string;
  Email: string;
  Password?: string;
  Number: string;
  Address: Address;
}

export type SellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Seller {
  Seller_ID: string;
  Username?: string;
  Name: string;
  Email: string;
  Password?: string;
  Number: string;
  Address: Address;
  Logo: string;
  Description: string;
  Status: SellerStatus;
  Created_At: string;
}

export interface Category {
  Category_ID: string;
  Name: string;
}

export type ProductStatus = 'active' | 'inactive' | 'deactivated';

export interface Product {
  Product_ID: string;
  Name: string;
  Image: string;
  Images?: string[];
  Description: string;
  Price: number;
  Voucher: string; // e.g. "SAVE10", "15% OFF", or ""
  Stock: number;
  Product_Status: ProductStatus;
  Category_ID: string;
  Seller_ID: string;
  Created_At?: string;
  Review_ID?: string; // FK to latest or primary review
  Size_Gender?: 'men' | 'women' | 'unisex';
  Sizes?: string[];
  Size_Chart?: SizeChartMeasurement[];
}

export interface SizeChartMeasurement {
  Size: string;
  Chest_CM?: number;
  Waist_CM?: number;
  Hip_CM?: number;
  Length_CM?: number;
}

export interface CartItem {
  Cart_ID: string;
  Customer_ID: string;
  Product_ID: string;
  Quantity: number;
  Size?: string;
  Product?: Product;
}

export interface OrderItem {
  Product_ID: string;
  Name: string;
  Price: number;
  Quantity: number;
  Image: string;
  Seller_ID: string;
  Size?: string;
}

export type OrderStatus = 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod =
  | 'bkash'
  | 'nagad'
  | 'rocket'
  | 'visa_mastercard'
  | 'sslcommerz'
  | 'cash_on_delivery';

export interface PaymentTransaction {
  id: string;
  order_id: string;
  customer_id: string;
  amount: number;
  currency: string;
  gateway: 'sslcommerz' | 'direct';
  payment_method: PaymentMethod | string;
  transaction_id: string;
  bank_tran_id?: string;
  val_id?: string;
  card_type?: string;
  card_brand?: string;
  card_issuer?: string;
  status: 'PENDING' | 'VALID' | 'VALIDATED' | 'FAILED' | 'CANCELLED';
  customer_phone?: string;
  created_at: string;
  validated_at?: string;
}

export interface Order {
  Order_ID: string;
  Tracking_ID: string;
  Customer_ID: string;
  Items: OrderItem[];
  Subtotal: number;
  Shipping_Fee: number;
  Status: OrderStatus;
  Payment_Status?: PaymentStatus;
  Payment_Method?: PaymentMethod | string;
  Transaction_ID?: string;
  Payment_ID?: string;
  Currency?: string;
  Shipping_Address: Address;
  Billing_Address: Address;
  Order_Placed_At: string;
  Additional_Info?: string;
  Seller_Fulfillment_ID?: string;
  Fulfillments?: OrderFulfillment[];
}

export interface OrderFulfillment {
  Fulfillment_ID: string;
  Seller_ID: string;
  Seller_Name: string;
  Status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  Items: OrderItem[];
  Rider_ID?: string;
  Rider_Name?: string;
  Rider_Number?: string;
  Delivery_Status?: RiderDelivery['Status'];
}

export type RiderStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Rider {
  Rider_ID: string;
  Username: string;
  Name: string;
  Email: string;
  Number: string;
  Present_Address: Address;
  Permanent_Address: Address;
  Experience: string[];
  Previous_Jobs: string[];
  Education: string[];
  Status: RiderStatus;
  Has_CV: boolean;
  CV_File_Name?: string;
  Current_Latitude?: number;
  Current_Longitude?: number;
  Total_Deliveries: number;
  Timely_Deliveries: number;
  Late_Deliveries: number;
  Performance_Points: number;
  Average_Rating?: number;
  Wallet_Balance: number;
  Created_At: string;
}

export interface RiderDelivery {
  Delivery_ID: string;
  Order_ID: string;
  Seller_Fulfillment_ID: string;
  Seller_ID: string;
  Seller_Name?: string;
  Rider_ID?: string;
  Status: 'pending' | 'accepted' | 'on_the_way' | 'delivered' | 'cancelled';
  Confirmation_Code?: string;
  COD_Amount: number;
  COD_Collected: boolean;
  Distance_KM?: number;
  Items: OrderItem[];
  Shipping_Address: Address;
  Payment_Method: PaymentMethod | string;
  Customer_Name: string;
  Customer_Number: string;
  Rider_Name?: string;
  Rider_Number?: string;
  Review_ID?: string;
}

export interface RiderReview {
  Review_ID: string;
  Delivery_ID: string;
  Rider_ID: string;
  Customer_ID: string;
  Rating: number;
  Review_Text: string;
  Was_Timely: boolean;
  Created_At: string;
}

export interface Review {
  Review_ID: string;
  Product_ID: string;
  Customer_ID: string;
  Customer_Name: string;
  Review_text: string;
  Rating: number; // 1 to 5
  Created_At: string;
}

export type AppTab =
  | 'storefront'
  | 'charts'
  | 'orders'
  | 'profile'
  | 'seller-dashboard'
  | 'admin-dashboard'
  | 'rider-dashboard'
  | 'live-tracking';

export type UserRole = 'customer' | 'seller' | 'admin' | 'rider';

export interface CurrentUser {
  role: UserRole;
  customer?: Customer;
  seller?: Seller;
  admin?: Admin;
}
