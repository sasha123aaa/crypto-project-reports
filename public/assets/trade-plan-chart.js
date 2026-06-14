class TradePlanChart {
  constructor(container, { candles, levels, range, currentPrice, bullish = true }) {
    this.container = container;
    this.levels = levels;
    this.range = range;
    this.currentPrice = currentPrice;
    this.chart = LightweightCharts.createChart(container, {
      layout:{ background:{ type:"solid",color:"#0b1020" },textColor:"#aeb8cc",fontFamily:"Inter,system-ui,sans-serif" },
      grid:{ vertLines:{color:"rgba(255,255,255,.035)"},horzLines:{color:"rgba(255,255,255,.045)"} },
      rightPriceScale:{borderColor:"rgba(255,255,255,.1)",scaleMargins:{top:.12,bottom:.12}},
      timeScale:{borderColor:"rgba(255,255,255,.1)",timeVisible:true,rightOffset:8,barSpacing:9,minBarSpacing:3},
      crosshair:{mode:LightweightCharts.CrosshairMode.Normal},
      handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
      handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},
      localization:{priceFormatter:(value)=>this.formatPrice(value)}
    });
    this.series=this.chart.addCandlestickSeries({upColor:"#42d392",downColor:"#ff6b7a",wickUpColor:"#42d392",wickDownColor:"#ff6b7a",borderVisible:false,priceLineVisible:false});
    this.series.setData(candles);
    const styles={entry:{color:"#56a3ff",style:0},average1:{color:"#f5c451",style:2},average2:{color:"#a778ff",style:2},take:{color:"#48d597",style:0}};
    Object.entries(levels).forEach(([key,level])=>this.series.createPriceLine({price:level.value,color:styles[key].color,lineWidth:key==="entry"?2:1,lineStyle:styles[key].style,axisLabelVisible:true,title:`${level.label} · ${this.formatPrice(level.value)}`}));
    this.series.createPriceLine({price:currentPrice,color:"#f5f7ff",lineWidth:2,lineStyle:1,axisLabelVisible:true,title:`Сейчас · ${this.formatPrice(currentPrice)}`});
    this.zone=document.createElement("div"); this.zone.className=`scenario-range-zone ${bullish?"bullish":"bearish"}`; container.appendChild(this.zone);
    this.badges=document.createElement("div"); this.badges.className="scenario-level-badges"; container.appendChild(this.badges);
    this.renderOverlay=()=>this.updateOverlay();
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.renderOverlay);
    this.resizeObserver=new ResizeObserver(()=>{this.chart.applyOptions({width:container.clientWidth,height:container.clientHeight});this.updateOverlay()});
    this.resizeObserver.observe(container); this.chart.timeScale().fitContent(); requestAnimationFrame(this.renderOverlay);
  }
  formatPrice(value){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value<1?6:2}).format(value)}
  updateOverlay(){
    const top=this.series.priceToCoordinate(this.range.high),bottom=this.series.priceToCoordinate(this.range.low);
    if(top==null||bottom==null)return;
    this.zone.style.top=`${top}px`;this.zone.style.height=`${Math.max(2,bottom-top)}px`;
    this.badges.innerHTML=Object.values(this.levels).map(level=>{const y=this.series.priceToCoordinate(level.value);return y==null?"":`<span class="scenario-badge ${level.state}" style="top:${y}px">${level.label}</span>`}).join("");
  }
}
window.TradePlanChart=TradePlanChart;
