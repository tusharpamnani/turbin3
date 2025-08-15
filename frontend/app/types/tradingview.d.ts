interface TradingViewWidget {
  new (config: {
    autosize: boolean;
    symbol: string;
    interval: string;
    timezone: string;
    theme: string;
    style: string;
    locale: string;
    toolbar_bg: string;
    enable_publishing: boolean;
    allow_symbol_change: boolean;
    container_id: string;
    [key: string]: any;
  }): any;
}

interface Window {
  TradingView: {
    widget: TradingViewWidget;
  };
} 