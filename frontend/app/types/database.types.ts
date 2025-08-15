export type User = {
    id: number;
    wallet_address: string;
    created_at: string; // ISO string
  };
  
  export type OrderStatus = 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';
  export type OrderSide = 'LONG' | 'SHORT';
  
  export type Order = {
    id: number;
    user_id: number;
    side: OrderSide;
    points: number;
    amount: number;
    filled_amount: number;
    status: OrderStatus;
    created_at: string;
  };
  
  export type Trade = {
    id: number;
    maker_order_id: number | null;
    taker_order_id: number | null;
    points: number;
    amount: number;
    executed_at: string;
  };
  
  export type Balance = {
    user_id: number;
    total_deposited: number;
    locked_amount: number;
    updated_at: string;
  };

  
export interface Database {
  public: {
    Tables: {
      users: { Row: User };
      orders: { Row: Order };
      trades: { Row: Trade };
      balances: { Row: Balance };
    };
  };
}
