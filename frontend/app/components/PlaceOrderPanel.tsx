"use client";

import React, { useState } from 'react';
import VolatilitySlider from './VolatilitySlider';
import PayoutVisualization from './PayoutVisualization';

type OrderSide = 'LONG' | 'SHORT';

type PlaceOrderPanelProps = {
  percent: number;
  setPercent: (value: number) => void;
  onPlaceOrder: (order: { side: OrderSide; amount: number; percent: number }) => Promise<void>;
  isLoading: boolean;
};

const PlaceOrderPanel: React.FC<PlaceOrderPanelProps> = ({ 
  percent, 
  setPercent, 
  onPlaceOrder,
  isLoading
}) => {
  const [side, setSide] = useState<OrderSide>('LONG');
  const [amount, setAmount] = useState<string>('');

  const handlePlaceOrder = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return alert("Enter a valid amount");
    await onPlaceOrder({ side, amount: numAmount, percent });
  };

  return (
    <div className="bg-zinc-900/50 backdrop-blur-md p-6 rounded-xl border border-zinc-700/50 flex flex-col gap-5">
      {/* Order Side Selection */}
      <div>
        <div className="flex gap-2">
          <button
            onClick={() => setSide('LONG')}
            disabled={isLoading}
            className={`flex-1 p-2 rounded text-center transition-colors ${
              side === 'LONG' 
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : 'bg-zinc-800 border border-zinc-700 hover:bg-zinc-700'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            BREAK OUT
          </button>
          <button
            onClick={() => setSide('SHORT')}
            disabled={isLoading}
            className={`flex-1 p-2 rounded text-center transition-colors ${
              side === 'SHORT'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-zinc-800 border border-zinc-700 hover:bg-zinc-700'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            STAY IN
          </button>
        </div>
      </div>

      {/* Payout Visualization */}
      <PayoutVisualization orderSide={side} amount={amount} className="my-1" />

      {/* Amount Input */}
      <div>
        <label className="block mb-1 text-sm text-zinc-400">Amount</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className="text-purple-400 font-bold">◎</span>
          </div>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter SOL to place order"
            disabled={isLoading}
            className={`w-full p-2 pl-8 rounded bg-zinc-800 text-white border border-zinc-700 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 text-xs">
            Devnet
          </div>
        </div>
      </div>

      {/* Volatility Slider */}
      <VolatilitySlider percent={percent} setPercent={setPercent} disabled={isLoading} />

      {/* Place Order Button */}
      <button
        onClick={handlePlaceOrder}
        disabled={isLoading}
        className={`w-full mt-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded transition-all flex items-center justify-center ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            Processing...
          </>
        ) : (
          <>
            <span className="text-white mr-2">◎</span> 
            Place Order
          </>
        )}
      </button>
    </div>
  );
};

export default PlaceOrderPanel;
