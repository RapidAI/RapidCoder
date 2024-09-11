<template>
  <div>
    <a-tree
        :treeData="treeData"
        :defaultExpandAll="false"
        :showLine="{ showLeafIcon: false }"
        :checkedKeys="messageStore.databaseInfoCheked"
        checkable
        @check="onCheck"
    />
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
import { useMessageStore } from "@/store/MessageStore.js";

export default {
  setup() {
    const messageStore = useMessageStore();
    const treeData = ref([]);

    // 当选中状态变化时的处理函数
    const onCheck = (checkedKeysValue) => {
      messageStore.databaseInfofilter(checkedKeysValue);
    };

    onMounted(()=>{
    })

    return {
      treeData,
      onCheck,
      messageStore,
    };
  },
};
</script>

<style scoped>
/* 添加一些样式以更好地展示树形结构 */
.ant-tree {
  background: #f5f5f5;
  padding: 20px;
}
</style>