class TradePlanChart {
  constructor(container, options) {
    this.container=container;
    container.innerHTML='<div class="trade-plan-plot"></div><aside class="trade-plan-gutter"><strong>Торговый план</strong><div class="trade-plan-gutter-levels"></div></aside>';
    this.plot=container.querySelector('.trade-plan-plot'); this.gutter=container.querySelector('.trade-plan-gutter'); this.gutterLevels=container.querySelector('.trade-plan-gutter-levels');
    this.chart=LightweightCharts.createChart(this.plot,{layout:{background:{type:'solid',color:'#0b1020'},textColor:'#aeb8cc',fontFamily:'Inter,system-ui,sans-serif'},grid:{vertLines:{color:'rgba(255,255,255,.035)'},horzLines:{color:'rgba(255,255,255,.045)'}},leftPriceScale:{visible:false},rightPriceScale:{visible:true,borderVisible:true,borderColor:'rgba(255,255,255,.24)',minimumWidth:78,scaleMargins:{top:.12,bottom:.12}},timeScale:{borderColor:'rgba(255,255,255,.1)',timeVisible:true,secondsVisible:false,rightOffset:8,barSpacing:5,minBarSpacing:1},crosshair:{mode:LightweightCharts.CrosshairMode.Normal},localization:{priceFormatter:v=>this.formatPrice(v)}});
    this.series=this.chart.addCandlestickSeries({upColor:'#42d392',downColor:'#ff6b7a',wickUpColor:'#42d392',wickDownColor:'#ff6b7a',borderVisible:false,priceLineVisible:false});
    this.overlay=document.createElement('div');this.overlay.className='scenario-overlay';this.plot.appendChild(this.overlay);
    this.renderOverlay=()=>requestAnimationFrame(()=>this.updateOverlay()); this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.renderOverlay);
    this.resizeObserver=new ResizeObserver(()=>{this.chart.applyOptions({width:this.plot.clientWidth,height:this.plot.clientHeight});this.renderOverlay()});this.resizeObserver.observe(container);this.setData(options);
  }
  formatPrice(v){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:v<1?6:2}).format(v)}
  formatTime(time){
    let millis;
    if(typeof time==='number')millis=Math.abs(time)>=1e12?time:time*1000;
    else if(typeof time==='string')millis=Date.parse(time);
    else if(time&&Number.isInteger(time.year)&&Number.isInteger(time.month)&&Number.isInteger(time.day))millis=Date.UTC(time.year,time.month-1,time.day);
    const date=new Date(millis);
    if(!Number.isFinite(date.getTime()))return '';
    const intraday=['1m','3m','5m','15m','1h','4h'].includes(this.timeframe),monthly=['1w','1M'].includes(this.timeframe);
    return new Intl.DateTimeFormat('ru-RU',monthly?{month:'short',year:'numeric',timeZone:'UTC'}:intraday?{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'}:{day:'2-digit',month:'short',timeZone:'UTC'}).format(date).replace(',','');
  }
  setData(options){Object.assign(this,options);this.container.classList.toggle('without-spot-plan',!this.showPlan);this.chart.applyOptions({timeScale:{timeVisible:['1m','3m','5m','15m','1h','4h'].includes(this.timeframe),secondsVisible:false,tickMarkFormatter:time=>this.formatTime(time)}});this.series.setData(this.candles);this.chart.timeScale().fitContent();this.renderOverlay()}
  updateOverlay(){
    if(!this.candles?.length)return; const r=this.range;
    if(r){const ax=this.chart.timeScale().timeToCoordinate(r.aTime),bx=this.chart.timeScale().timeToCoordinate(r.bTime),ay=this.series.priceToCoordinate(r.aPrice),by=this.series.priceToCoordinate(r.bPrice);if([ax,bx,ay,by].every(v=>v!=null)){const left=Math.min(ax,bx),top=Math.min(ay,by),width=Math.max(2,Math.abs(bx-ax)),height=Math.max(2,Math.abs(by-ay));this.overlay.innerHTML=`<div class="range-segment ${r.bullish?'bullish':'bearish'}" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px"><i class="range-line range-line-a" style="top:${ay-top}px"></i><i class="range-line range-line-b" style="top:${by-top}px"></i></div><span class="range-point range-a" style="left:${ax}px;top:${ay}px"></span><span class="range-point range-b ${r.bullish?'bullish':'bearish'}" style="left:${bx}px;top:${by}px"></span>`}else this.overlay.innerHTML=''}else this.overlay.innerHTML='';
    this.gutterLevels.innerHTML=Object.values(this.levels).map(l=>{const y=this.series.priceToCoordinate(l.value);return y==null?'':`<div class="gutter-level ${l.state}" style="top:${y}px"><span>${l.label}</span><i></i><b>${this.formatPrice(l.value)}</b></div>`}).join('');
  }
}
window.TradePlanChart=TradePlanChart;
