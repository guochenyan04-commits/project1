import React, { useEffect, useState, useRef } from 'react';
/*
PokéTrade Demo - single-file React component
- TailwindCSS utility classes used for styling (no imports required)
- Uses recharts for the price chart (assumed available)
- Small in-memory simulated orderbook + matching engine + mark-to-market PnL
- Right panel contains an embedded white-paper (markdown-like) viewer

How to use:
- Drop this component into a Create-React-App / Vite app that supports Tailwind.
- Ensure you have `recharts` installed: `npm install recharts`.

Notes:
- This is an educational demo (paper trading). It does NOT handle real money.
- The price feed is simulated locally. Replace with real index/API for production.
*/

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function PokeTradeDemo() {
  // --- Config / Product universe ---
  const PRODUCTS = [
    { id: '151_ETB', name: '151 Elite Trainer Box' },
    { id: 'SV_PF_ETB', name: 'SV Paldean Fates ETB' },
    { id: 'BASE_CHAR_PSA10', name: 'Base Set Charizard PSA10' }
  ];

  const [selected, setSelected] = useState(PRODUCTS[0].id);
  const [priceSeries, setPriceSeries] = useState(() => generateInitialSeries(150, 60));
  const [midPrice, setMidPrice] = useState(priceSeries[priceSeries.length - 1].price);
  const [orderbook, setOrderbook] = useState({ bids: [], asks: [] });
  const [orders, setOrders] = useState([]); // user open positions
  const [cash, setCash] = useState(10000); // USD starting capital
  const [positionIdCounter, setPositionIdCounter] = useState(1);
  const [orderForm, setOrderForm] = useState({ side: 'buy', price: '', qty: 1, type: 'limit' });
  const seriesRef = useRef(priceSeries);
  seriesRef.current = priceSeries;

  // --- Simulated price feed (index) ---
  useEffect(() => {
    const iv = setInterval(() => {
      setPriceSeries(old => {
        const last = old[old.length - 1];
        const drift = (Math.random() - 0.5) * 1.5; // small randomness
        const newPrice = Math.max(1, +(last.price + drift).toFixed(2));
        const next = { time: new Date().toLocaleTimeString(), price: newPrice };
        const nextArr = [...old.slice(-120), next];
        setMidPrice(newPrice);
        // update a synthetic orderbook around mid
        setOrderbook(makeSyntheticBook(newPrice));
        return nextArr;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [selected]);

  // --- Basic matching engine simulation for market orders ---
  useEffect(() => {
    // Execute any market orders in user's orders list
    // In this simple demo, place order with type 'market' -> immediate execution at midPrice
    setOrders(curr => {
      const updated = curr.map(o => {
        if (!o.filled && o.type === 'market') {
          const execPrice = midPrice;
          const pnl = (o.side === 'buy') ? (0) : (0); // no immediate pnl; position created
          return { ...o, filled: true, execPrice, timestamp: new Date().toLocaleTimeString() };
        }
        return o;
      });
      return updated;
    });
  }, [midPrice]);

  // --- Mark-to-market PnL calculation ---
  useEffect(() => {
    // update unrealized PnL for positions
    setOrders(curr => curr.map(o => {
      if (!o.filled) return o;
      const size = o.qty;
      let unreal = 0;
      if (o.side === 'buy') unreal = (midPrice - o.execPrice) * size;
      else unreal = (o.execPrice - midPrice) * size;
      return { ...o, unrealized: +unreal.toFixed(2) };
    }));
  }, [midPrice]);

  // --- Helpers & handlers ---
  function generateInitialSeries(base = 150, count = 60) {
    const arr = [];
    let p = base;
    for (let i = 0; i < count; i++) {
      p = +(p + (Math.random() - 0.5) * 2).toFixed(2);
      arr.push({ time: `${i}`, price: Math.max(1, p) });
    }
    return arr;
  }

  function makeSyntheticBook(mid) {
    const spread = +(mid * 0.01).toFixed(2);
    const bids = [];
    const asks = [];
    for (let i = 0; i < 8; i++) {
      bids.push({ price: +(mid - (i * spread / 2)).toFixed(2), qty: Math.floor(Math.random() * 5) + 1 });
      asks.push({ price: +(mid + (i * spread / 2)).toFixed(2), qty: Math.floor(Math.random() * 5) + 1 });
    }
    return { bids: bids.sort((a,b)=>b.price-a.price), asks: asks.sort((a,b)=>a.price-b.price) };
  }

  function placeOrder() {
    const { side, type, qty } = orderForm;
    let price = parseFloat(orderForm.price || midPrice);
    const id = positionIdCounter;
    setPositionIdCounter(id + 1);
    const newOrder = {
      id,
      product: selected,
      side,
      type,
      price,
      qty: Number(qty),
      created: new Date().toLocaleTimeString(),
      filled: type === 'market' ? false : false, // limit orders remain open in this demo
      execPrice: null,
      unrealized: 0
    };

    // For market orders, immediately create a filled position at midPrice
    if (type === 'market') {
      newOrder.filled = true;
      newOrder.execPrice = midPrice;
    }

    setOrders(prev => [newOrder, ...prev]);

    // adjust cash for initial margin if leverage allowed in later iterations
    return newOrder;
  }

  function closePosition(orderId) {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId && o.filled) {
        // realize PnL
        const size = o.qty;
        let pnl = 0;
        if (o.side === 'buy') pnl = (midPrice - o.execPrice) * size;
        else pnl = (o.execPrice - midPrice) * size;
        setCash(c => +(c + pnl).toFixed(2));
        return { ...o, closed: true, closedPrice: midPrice, realized: +pnl.toFixed(2) };
      }
      return o;
    }));
  }

  function formatUSD(x) { return `$${Number(x).toFixed(2)}`; }

  // --- Whitepaper content (short) ---
  const whitepaper = `
# PokéTrade — Synthetic Pokémon Exchange (Concept Whitepaper)

**Vision**: Create a liquid, transparent, cash-settled marketplace for exposure to high-value Pokémon collectibles without the platform taking physical custody. Traders can gain price exposure, hedge, and speculate using derivatives-like instruments referencing a published price index.

**Product**: Cash-settled perpetual and spot contracts referencing a published Pokémon Price Index (PPI). No delivery—contracts settle in USD.

**Key features**:
- Index-based pricing (aggregate of market sources)
- Cash-only settlement (no physical deliveries)
- Perpetual funding to anchor contract price to the index
- Transparent methodology and simulated proof-of-solvency

**Risk & Compliance**: This demo is educational; a live service requires licensing and consumer protections. For production: KYC/AML, clear disclaimers, capital requirements, and potential derivatives licensing.

**Conclusion**: The synthetic model allows maximal liquidity and minimal operational burden while preserving price discovery for physical Pokemon products.
`;

  // --- Render ---
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-extrabold">PokéTrade Demo</div>
          <div className="text-sm text-gray-500">Synthetic, cash-settled collectible exposure</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm">Balance: <span className="font-mono">{formatUSD(cash)}</span></div>
          <select value={selected} onChange={e=>setSelected(e.target.value)} className="p-2 border rounded">
            {PRODUCTS.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 p-4">
        {/* Left: Orderbook & Order Entry */}
        <aside className="col-span-3 bg-white rounded shadow p-3">
          <h3 className="font-semibold">Orderbook ({selected})</h3>
          <div className="mt-2 h-64 overflow-auto text-sm">
            <div className="flex">
              <div className="w-1/2">
                <div className="text-xs text-gray-500">Bids</div>
                {orderbook.bids?.map((b,i)=> (
                  <div key={i} className="flex justify-between text-green-600 py-1">
                    <div className="font-mono">{b.qty}</div>
                    <div className="font-mono">{formatUSD(b.price)}</div>
                  </div>
                ))}
              </div>
              <div className="w-1/2">
                <div className="text-xs text-gray-500">Asks</div>
                {orderbook.asks?.map((a,i)=> (
                  <div key={i} className="flex justify-between text-red-600 py-1">
                    <div className="font-mono">{formatUSD(a.price)}</div>
                    <div className="font-mono">{a.qty}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="font-medium">Place Order</h4>
            <div className="flex flex-col gap-2 mt-2 text-sm">
              <div className="flex gap-2">
                <button onClick={()=>setOrderForm(f=>({...f, side:'buy'}))} className={`p-2 rounded ${orderForm.side==='buy'?'bg-green-100':'bg-gray-100'}`}>Buy</button>
                <button onClick={()=>setOrderForm(f=>({...f, side:'sell'}))} className={`p-2 rounded ${orderForm.side==='sell'?'bg-red-100':'bg-gray-100'}`}>Sell</button>
              </div>
              <select value={orderForm.type} onChange={e=>setOrderForm(f=>({...f,type:e.target.value}))} className="p-2 border rounded">
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
              <input placeholder="Price (leave blank for market)" value={orderForm.price} onChange={e=>setOrderForm(f=>({...f,price:e.target.value}))} className="p-2 border rounded" />
              <input type="number" min={1} value={orderForm.qty} onChange={e=>setOrderForm(f=>({...f,qty:e.target.value}))} className="p-2 border rounded" />
              <button onClick={placeOrder} className="mt-2 p-2 bg-blue-600 text-white rounded">Place</button>
            </div>
          </div>
        </aside>

        {/* Center: Chart & market */}
        <section className="col-span-6 bg-white rounded shadow p-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{PRODUCTS.find(p=>p.id===selected).name} — Market</h3>
            <div className="text-lg font-mono">{formatUSD(midPrice)}</div>
          </div>

          <div className="flex-1 mt-2">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={priceSeries}>
                <XAxis dataKey="time" hide />
                <YAxis domain={[dataMin => Math.floor(dataMin*0.98), dataMax => Math.ceil(dataMax*1.02)]} />
                <Tooltip />
                <Line type="monotone" dataKey="price" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 text-sm text-gray-600">
              <div>Index Methodology: Synthetic index aggregated from marketplace data sources (eBay/TCGPlayer/StockX). Updated every second in demo.</div>
            </div>
          </div>

        </section>

        {/* Right: Portfolio, Orders, Whitepaper */}
        <aside className="col-span-3 bg-white rounded shadow p-3 flex flex-col gap-3">
          <div>
            <h4 className="font-semibold">Positions</h4>
            <div className="h-40 overflow-auto text-sm mt-2">
              {orders.length===0 && <div className="text-gray-400">No positions yet.</div>}
              {orders.map(o=> (
                <div key={o.id} className={`p-2 rounded mb-2 ${o.closed ? 'bg-gray-50' : 'bg-white'}`}>
                  <div className="flex justify-between"><div className="font-medium">{o.side.toUpperCase()} {o.qty}</div><div className="font-mono">{o.filled?formatUSD(o.execPrice||0):'OPEN'}</div></div>
                  <div className="text-xs text-gray-500">Created: {o.created} {o.closed && `/ Closed: ${o.closed ? o.closedPrice : ''}`}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-xs">Unreal: <span className={`font-mono ${o.unrealized>=0?'text-green-600':'text-red-600'}`}>{formatUSD(o.unrealized||0)}</span></div>
                    <div>
                      {!o.closed && o.filled && <button onClick={()=>closePosition(o.id)} className="text-xs px-2 py-1 border rounded">Close</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <h4 className="font-semibold">Whitepaper (summary)</h4>
            <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap" style={{whiteSpace: 'pre-wrap'}}>{whitepaper}</div>
          </div>

        </aside>

      </main>

      <footer className="p-3 text-xs text-gray-500 text-center">Demo for educational purposes. Not financial advice. Replace simulated feeds with authenticated APIs for production. Ensure legal compliance.</footer>
    </div>
  );
}
