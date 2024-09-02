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
import { useMessageStore } from "@/store/MessageStoreWithBigData.js";

export default {
  setup() {
    const messageStore = useMessageStore();
    const treeData = ref([]);

    // 格式化数据库信息以适应树形结构
    const formatTreeData = (databases) => {
      const formatTitle = (name, comment, description) =>
          [name, comment, description].filter(Boolean).join(' : ');

      return databases.map(db => ({
        title: formatTitle(db.databaseName, db.databaseDescription),
        key: db.databaseName,
        children: (db.tables || []).map(table => ({
          title: formatTitle(table.tableName, table.tableComment, table.tableDescription),
          key: `${db.databaseName}.${table.tableName}`,
          children: (table.columns || []).map(column => ({
            title: formatTitle(column.columnName, column.columnComment, column.columnDescription),
            key: `${db.databaseName}.${table.tableName}.${column.columnName}`,
          })),
        })),
      }));
    };


    // 当选中状态变化时的处理函数
    const onCheck = (checkedKeysValue) => {
      messageStore.databaseInfofilter(checkedKeysValue);
    };

    onMounted(()=>{
      treeData.value = formatTreeData(messageStore.databaseInfo);
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