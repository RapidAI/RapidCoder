<template>
  <a-spin :indicator="indicator" />
</template>

<script>
import { h } from 'vue';
import { LoadingOutlined } from '@ant-design/icons-vue';

export default {
  components: {},
  setup() {
    // 创建带有旋转属性的 LoadingOutlined 图标
    const indicator = h(LoadingOutlined, {
      style: { fontSize: '18px' },
      spin: true,
    });

    // 在 setup 中返回需要在模板中使用的变量
    return {
      indicator,
    };
  },
};
</script>
