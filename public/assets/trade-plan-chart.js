class TradePlanChart {
  constructor(container, options) {
    this.container = container;
    this.chart = LightweightCharts.createChart(container, {
      layout:{background:{type:"solid",color:"#0b1020"},textColor:"#aeb8cc",fontFamily:"Inter,system-ui,sans-serif"},
      grid:{vertLines:{color:"rgba(255,255,255,.035)"},horzLines:{color:"rgba(255,255,255,.045)"}},
      rightPriceScale:{borderColor:"rgba(255,255,255,.1)",scaleMargins:{top:.12,bottom:.12}},
      timeScale:{borderColor:"rgba(255,255,255,.1)",timeVisible:true,rightOffset:8,barSpacing:5,minBarSpacing:1},
      crosshair:{mode:LightweightCharts.CrosshairMode.Normal},
      handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
      handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},
      localization:{priceFormatter:value=>this.formatPrice(value)}
    });
    this.series = this.chart.addCandlestickSeries({upColor:"#42d392",downColor:"#ff6b7a",wickUpColor:"#42d392",wickDownColor:"#ff6b7a",borderVisible:false,priceLineVisible:false});
    this.overlay = document.createElement("div");
    this.overlay.className = "scenario-overlay";
    container.appendChild(this.overlay);
    this.renderOverlay = () => requestAnimationFrame(() => this.updateOverlay());
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.renderOverlay);
    this.chart.timeScale().subscribeVisibleTimeRangeChange(this.renderOverlay);
    this.chart.subscribeCrosshairMove(this.renderOverlay);
    this.resizeObserver = new ResizeObserver(() => {
      this.chart.applyOptions({width:container.clientWidth,height:container.clientHeight});
      this.renderOverlay();
    });
    this.resizeObserver.observe(container);
    this.setData(options);
  }
  formatPrice(value) { return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value<1?6:2}).format(value); }
  setData({candles, levels, range, currentPrice, bullish=true}) {
    this.candles = candles;
    this.levels = levels;
    this.range = range;
    this.currentPrice = currentPrice;
    this.bullish = bullish;
    this.series.setData(candles);
    this.chart.timeScale().fitContent();
    this.renderOverlay();
  }
  updateOverlay() {
    if (!this.candles?.length) return;
    const a = this.chart.timeScale().timeToCoordinate(this.range.startTime);
    const b = this.chart.timeScale().timeToCoordinate(this.range.endTime);
    const top = this.series.priceToCoordinate(this.range.high);
    const bottom = this.series.priceToCoordinate(this.range.low);
    if ([a,b,top,bottom].some(value => value == null)) { this.overlay.innerHTML=""; return; }
    const left=Math.min(a,b), width=Math.max(2,Math.abs(b-a)), height=Math.max(2,bottom-top);
    const levels=[...Object.values(this.levels),{label:"Сейчас",value:this.currentPrice,state:"current"}];
    this.overlay.innerHTML=`<div class="scenario-range-zone ${this.bullish?"bullish":"bearish"}" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px"></div>
      ${levels.map(level=>{const y=this.series.priceToCoordinate(level.value);return y==null?"":`<div class="scenario-level-line ${level.state}" style="left:${left}px;top:${y}px;width:${width}px"></div><span class="scenario-badge ${level.state}" style="top:${y}px">${level.label}</span>`}).join("")}`;
  }
  destroy() {
    this.resizeObserver.disconnect();
    this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.renderOverlay);
    this.chart.timeScale().unsubscribeVisibleTimeRangeChange(this.renderOverlay);
    this.chart.unsubscribeCrosshairMove(this.renderOverlay);
    this.chart.remove();
  }
}
window.TradePlanChart=TradePlanChart;
