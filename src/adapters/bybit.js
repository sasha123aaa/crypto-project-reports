export async function getTechnicalBias(bybitSymbol){
  return { source:"Bybit spot", updated_at:new Date().toISOString(), symbol:bybitSymbol,
    timeframes:{"1m":"bullish","3m":"bullish","5m":"bullish","15m":"bullish","1h":"bullish","4h":"bullish","1d":"bearish","1w":"bullish"},
    notes:{ lower_tf:"На младших ТФ структура выглядит сильнее и смещена в сторону покупателей.", mid_tf:"На средних ТФ сохраняется более сильная структура.", higher_tf:"На дневке и неделе долгосрочный перевес пока нельзя считать окончательно подтвержденным."}
  };
}
