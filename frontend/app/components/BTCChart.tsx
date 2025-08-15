'use client'
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Position } from '../services/positions';

const ReactApexChart = dynamic(
  () => import('react-apexcharts'),
  { ssr: false }
);

interface CandlestickData {
  x: Date;
  y: [number, number, number, number];
}

interface BTCChartProps {
  bounds: { upper: number | null; lower: number | null };
  price: number | null;
  activePositions?: Position[] | null;
  selectedPosition?: Position | null;
}

const BTCChart: React.FC<BTCChartProps> = ({ bounds, price, activePositions, selectedPosition }) => {
  const [priceData, setPriceData] = useState<CandlestickData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchHistoricalData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        'https://min-api.cryptocompare.com/data/v2/histohour?fsym=BTC&tsym=USD&limit=48&aggregate=1'
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch historical data: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.Data || !data.Data.Data || !Array.isArray(data.Data.Data)) {
        throw new Error('Invalid or empty historical data format');
      }
      
      const historicalData = data.Data.Data.map((item: any) => ({
        x: new Date(item.time * 1000), 
        y: [item.open, item.high, item.low, item.close]
      }));
      
      setPriceData(historicalData);
      
    } catch (error) {
      console.error('Error fetching historical data:', error);
    
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoricalData();
    
    const intervalId = setInterval(fetchHistoricalData, 15 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  useEffect(() => {
  }, [price, bounds, activePositions, selectedPosition]);

  const displayBounds = selectedPosition
    ? { upper: selectedPosition.upper_bound, lower: selectedPosition.lower_bound }
    : { upper: bounds.upper, lower: bounds.lower };

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'candlestick',
      height: 500,
      background: '#131722',
      animations: {
        enabled: true,
        speed: 800,
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      },
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        },
        autoSelected: 'zoom'
      }
    },
    theme: {
      mode: 'dark'
    },
    grid: {
      borderColor: '#43577b',
      strokeDashArray: 3
    },
    tooltip: {
      enabled: true,
      intersect: false,
      shared: true,
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
        const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
        const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
        const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
        
        return `
          <div class="apexcharts-tooltip-candlestick" style="padding: 10px; background: #131722; color: white; border: 1px solid #43577b;">
            <div>Date: ${new Date(w.globals.seriesX[seriesIndex][dataPointIndex]).toLocaleString()}</div>
            <div>Open: <span style="color: #bbb;">$${o.toLocaleString()}</span></div>
            <div>High: <span style="color: #bbb;">$${h.toLocaleString()}</span></div>
            <div>Low: <span style="color: #bbb;">$${l.toLocaleString()}</span></div>
            <div>Close: <span style="color: #bbb;">$${c.toLocaleString()}</span></div>
          </div>
        `;
      },
      followCursor: true,
      marker: {
        show: false
      },
      x: {
        show: true
      }
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#26A69A',  
          downward: '#EF5350'
        },
        wick: {
          useFillColor: true
        }
      },
      bar: {
        columnWidth: '70%'  
      }
    },
    fill: {
      opacity: 1,
    },
    stroke: {
      width: 1  
    },
    title: {
      text: selectedPosition ? `BTC/USD Price Chart (Position #${selectedPosition.id} Active)` : 'BTC/USD Price Chart',
      align: 'left',
      style: {
        fontSize: '16px',
        color: '#ffffff'
      }
    },
    annotations: {
      yaxis: [
        ...(displayBounds.upper ? [
          {
            y: displayBounds.upper,
            borderColor: '#26A69A', 
            borderWidth: 2,
            strokeDashArray: 5,
            label: {
              text: `Upper: $${displayBounds.upper.toLocaleString()}`,
              position: 'right',
              style: {
                background: '#131722',
                color: '#26A69A', 
                fontSize: '12px',
                fontWeight: 'bold',
                padding: {
                  left: 10,
                  right: 10,
                  top: 5,
                  bottom: 5
                }
              }
            }
          }
        ] : []),
        ...(displayBounds.lower ? [
          {
            y: displayBounds.lower,
            borderColor: '#EF5350',  
            borderWidth: 2,
            strokeDashArray: 5,
            label: {
              text: `Lower: $${displayBounds.lower.toLocaleString()}`,
              position: 'right',
              style: {
                background: '#131722',
                color: '#EF5350', 
                fontSize: '12px',
                fontWeight: 'bold',
                padding: {
                  left: 10,
                  right: 10,
                  top: 5,
                  bottom: 5
                }
              }
            }
          }
        ] : []),
        ...(price ? [
          {
            y: price,
            borderColor: '#FFFFFF',  
            borderWidth: 2,
            strokeDashArray: 5,
            label: {
              position: 'right',
              style: {
                background: '#FFFFFF',  
                color: '#131722',  
                fontSize: '12px',
                fontWeight: 'bold',
                padding: {
                  left: 10,
                  right: 10,
                  top: 5,
                  bottom: 5
                }
              }
            }
          }
        ] : [])
      ]
    },
    xaxis: {
      type: 'datetime',
      axisBorder: {
        color: '#43577b'
      },
      axisTicks: {
        color: '#43577b'
      },
      labels: {
        style: {
          colors: '#ffffff'
        }
      }
    },
    yaxis: {
      tooltip: {
        enabled: true
      },
      labels: {
        style: {
          colors: '#ffffff'
        },
        formatter: (value) => {
          return `$${value.toLocaleString()}`
        }
      },
      ...(displayBounds.upper && displayBounds.lower ? {
        min: Math.floor(displayBounds.lower * 0.99),
        max: Math.ceil(displayBounds.upper * 1.01)
      } : {}),
    },
  };

  if (displayBounds.upper && displayBounds.lower) {
    let fillColor = '#4285F4';
    
    if (selectedPosition) {
      fillColor = selectedPosition.position_type === 0 
        ? 'rgba(38, 166, 154, 0.15)' 
        : 'rgba(239, 83, 80, 0.15)'; 
    }
    
    options.fill = {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'vertical',
        shadeIntensity: 0.5,
        opacityFrom: 0.4,
        opacityTo: 0.2,
        stops: [0, 100],
        colorStops: [
          {
            offset: 0,
            color: fillColor,
            opacity: 0.4
          },
          {
            offset: 100,
            color: fillColor,
            opacity: 0.2
          }
        ]
      }
    };
  }

  const series = [{
    name: 'BTC/USD',
    data: priceData
  }];

  return (
    <div className="chart-container" style={{ backgroundColor: '#131722', padding: '20px', borderRadius: '8px' }}>
      
      {loading ? (
        <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          Loading chart data...
        </div>
      ) : (
        <ReactApexChart 
          options={options} 
          series={series} 
          type="candlestick" 
          height={500} 
        />
      )}
      
      {price && (
        <div style={{ 
          marginTop: '15px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          color: 'white', 
          fontSize: '14px',
          padding: '10px',
          backgroundColor: 'rgba(0,0,0,0.2)',
          borderRadius: '4px'
        }}>
          <div>
            <strong>Current BTC Price:</strong> ${price.toLocaleString()}
          </div>
          <div>
            <em>Last updated: {new Date().toLocaleTimeString()}</em>
          </div>
        </div>
      )}
      
      {selectedPosition && (
        <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-md text-center">
          <p className="text-sm text-blue-300">
            <span className="font-medium">Position #{selectedPosition.id} Active:</span> Bounds are frozen at lower: ${selectedPosition.lower_bound.toLocaleString()} and upper: ${selectedPosition.upper_bound.toLocaleString()}
          </p>
          <p className="text-xs text-blue-400 mt-1">
            {selectedPosition.position_type === 0 
              ? 'SHORT/stay-in position - profit if price remains between bounds' 
              : 'LONG/break-out position - profit if price breaks outside bounds'}
          </p>
        </div>
      )}
    </div>
  );
};

export default BTCChart;