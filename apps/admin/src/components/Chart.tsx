import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';

interface ChartProps {
  option: echarts.EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  onChartReady?: (chart: echarts.ECharts) => void;
}

const Chart: React.FC<ChartProps> = ({ option, style, className, onChartReady }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
      if (onChartReady) {
        onChartReady(chartInstance.current);
      }
    }

    chartInstance.current.setOption(option);

    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [option]);

  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={chartRef}
      className={className}
      style={{ width: '100%', height: 300, ...style }}
    />
  );
};

export default Chart;
