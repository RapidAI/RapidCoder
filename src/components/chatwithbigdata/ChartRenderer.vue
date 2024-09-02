<template>
  <div class="chart-container" ref="chartContainer"></div>
</template>

<script>
import * as echarts from 'echarts';
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

export default {
  props: {
    chartData: {
      type: Object,
      required: true,
    },
    chartOptions: {
      type: Object,
      default: () => ({}),
    },
  },
  setup(props) {
    const chartContainer = ref(null);
    let chart = null;

    // 获取图表选项的函数
    const getChartOptions = (chartType, data, customOptions) => {
      let options = {
        title: {
          text: customOptions.title || '',
        },
        tooltip: {
          trigger: 'item',
        },
        legend: {
          data: [],
        },
        series: [],
        ...customOptions,
      };

      switch (chartType) {
        case 'pie':
          options.legend.data = data.labels;
          options.series = [{
            type: 'pie',
            data: data.labels.map((label, index) => ({
              value: data.datasets[0].data[index],
              name: label,
            })),
          }];
          break;
        case 'bar':
          options.legend.data = data.datasets.map(dataset => dataset.label);
          options.series = data.datasets.map(dataset => ({
            type: 'bar',
            name: dataset.label,
            data: dataset.data,
            itemStyle: {
              color: dataset.backgroundColor,
            },
          }));
          options.xAxis = {
            type: 'category',
            data: data.labels,
          };
          options.yAxis = {
            type: 'value',
          };
          break;
        case 'line':
          options.legend.data = data.datasets.map(dataset => dataset.label);
          options.series = data.datasets.map(dataset => ({
            type: 'line',
            name: dataset.label,
            data: dataset.data,
            itemStyle: {
              color: dataset.backgroundColor,
            },
          }));
          options.xAxis = {
            type: 'category',
            data: data.labels,
          };
          options.yAxis = {
            type: 'value',
          };
          break;
        case 'radar':
          options.legend.data = data.datasets.map(dataset => dataset.label);
          options.radar = {
            indicator: data.labels.map(label => ({name: label})),
          };
          options.series = data.datasets.map(dataset => ({
            type: 'radar',
            name: dataset.label,
            data: [
              {
                value: dataset.data,
                name: dataset.label,
                areaStyle: {
                  color: dataset.backgroundColor,
                },
              },
            ],
          }));
          break;
        case 'polarArea':
          options.legend.data = data.labels;
          options.series = [{
            type: 'pie',
            radius: '75%',
            roseType: 'area',
            data: data.labels.map((label, index) => ({
              value: data.datasets[0].data[index],
              name: label,
              itemStyle: {
                color: data.datasets[0].backgroundColor[index],
              },
            })),
          }];
          break;
        case 'scatter':
          options.legend.data = data.datasets.map(dataset => dataset.label);
          options.series = data.datasets.map(dataset => ({
            type: 'scatter',
            name: dataset.label,
            data: dataset.data.map(point => [point.x, point.y]),
            itemStyle: {
              color: dataset.backgroundColor,
            },
          }));
          options.xAxis = {
            type: 'value',
          };
          options.yAxis = {
            type: 'value',
          };
          break;
        default:
          break;
      }

      return options;
    };

    // 渲染图表的函数
    const renderChart = () => {
      if (chart) {
        const {chartType, data} = props.chartData;
        const options = getChartOptions(chartType, data, props.chartOptions);
        chart.setOption(options);
      }
    };

    // 监听 chartData 和 chartOptions 的变化并重新渲染图表
    watch(
        () => props.chartData,
        () => {
          // 延迟渲染以确保 DOM 完全加载
          nextTick(() => {
            renderChart();
          });
        },
        {deep: true}
    );

    watch(
        () => props.chartOptions,
        () => {
          nextTick(() => {
            renderChart();
          });
        },
        {deep: true}
    );

    // 在组件挂载时初始化图表
    onMounted(() => {
      nextTick(() => {
        chart = echarts.init(chartContainer.value);
        renderChart();
      });
    });

    // 在组件销毁前释放图表实例
    onBeforeUnmount(() => {
      if (chart) {
        chart.dispose();
      }
    });

    return {
      chartContainer,
    };
  },
};
</script>

<style scoped>
.chart-container {
  min-height: 400px;
  max-height: 600px;
  width: 100%;
}
</style>