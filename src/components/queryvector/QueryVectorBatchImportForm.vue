<template>
  <div class="top-box">
    <a-select
        v-model:value="selectedDatabaseId"
        show-search
        placeholder="数据库名称"
        style="width: 200px"
        :options="treeData"
    >
    </a-select>
    <a-select
        v-model:value="selectedModelId"
        show-search
        placeholder="AI模型"
        style="width: 200px;margin-left: 2%"
        :options="modelOptions"
        @change="handleModelChange"
    >
    </a-select>
    <div class="sqlUpdate">
      <a-upload
          :customRequest="handleUpload"
          :fileList="fileList"
          @change="handleChange"
          :showUploadList="false"
      >
        <a-button :loading="uploading">
          {{ uploading ? '正在解析' : '选择件' }}
        </a-button>
      </a-upload>
    </div>
  </div>
  <div class="table-container">
    <a-table :columns="columns" :dataSource="queryVectors" :rowKey="record => record.queryVectorId" class="table">
      <template v-slot:bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'action'">
          <a-space>
            <a-button type="primary" @click="showModal('edit', record)">编辑</a-button>
            <a-popconfirm title="确定要删除吗？" okText="确定" cancelText="取消"
                          @confirm="() => deleteQueryVector(record.queryVectorId)">
              <a-button type="primary">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
        <template v-else>
          {{ record[column.dataIndex] }}
        </template>
      </template>
    </a-table>
  </div>
  <a-form-item :wrapper-col="{ span: 20, offset: 20 }">
    <a-button type="primary" @click="onSubmit">确认</a-button>
    <a-button style="margin-left: 10px" @click="onCancel">取消</a-button>
  </a-form-item>
</template>

<script>
import {onMounted, ref, watch} from "vue";
import {post} from '@/api';
import {useQueryVectorMessageStore} from "@/store/QueryVectorMessageStore.js";
import {useUserStore} from "@/store/UserStore.js"; // 导入用户存储
import {message} from 'ant-design-vue'; // 导入 message 对象

export default {
  props: {
    selectedDatabaseId: {
      type: String,
      default: '0'
    }
  },
  emits: ['onCancel'], // 声明 onCancel 事件
  setup(props, {emit}) {
    const queryVectorMessageStore = useQueryVectorMessageStore();
    const userStore = useUserStore(); // 获用户存储
    const queryVectors = ref([]);
    const treeData = ref([]); // 数据库名称选项
    const selectedDatabaseId = ref(props.selectedDatabaseId); // 选中的数据库ID
    const modelOptions = ref([]); // 模型选项
    const selectedModelId = ref(null); // 选中的模型ID
    const models = ref([]);
    const fileList = ref([]); // 初始化 filst
    const uploading = ref(false); // 控制上的加载状态
    const databases = ref([]);

    const columns = ref([
      {title: '查询文本', dataIndex: 'queryText', align: 'center'},
      {title: '查询结果', dataIndex: 'resultText', align: 'center'},
      {title: '状态', dataIndex: 'success', align: 'center'},
      {title: '操作', dataIndex: 'action', ign: 'center'}
    ]);

    // 监听 selectedDatabaseId 变化
    watch(() => props.selectedDatabaseId, (newDatabaseId) => {
      selectedDatabaseId.value = newDatabaseId;
    });

    // 加载所有数据库信息
    const loadDatabases = async () => {
      try {
        const res = await post('/databases/getAll');
        if (res?.success) {
          databases.value = res.data;
          treeData.value = res.data.map(database => ({
            label: database.databaseName,
            value: String(database.databaseInfoId)
          }));

          selectedDatabaseId.value = treeData.value[0]?.value;
          await loadModels();
        }
      } catch (error) {
        console.error('加载数据库信息失败：', error);
      }
    };


    // 获取所有AI模型
    const loadModels = async () => {
      try {
        const response = await post('/model/getAll');
        models.value = response.data;
        modelOptions.value = models.value.map(model => ({
          value: model.modelId,
          label: model.modelName
        }));

        // 默认选择第一个模型
        if (modelOptions.value.length > 0) {
          selectedModelId.value = modelOptions.value[0].value;
          handleModelChange(selectedModelId.value); // 确保默认选择的模型被正确设置
        }
      } catch (error) {
        console.error('获取AI模型失败:', error);
      }
    };

    // 处理模型改变
    const handleModelChange = (modelId) => {
      selectedModelId.value = modelId;
      const selectedModel = models.value.find(model => model.modelId === modelId);
      if (selectedModel) {
        queryVectorMessageStore.currentModel = selectedModel;
      } else {
        queryVectorMessageStore.currentModel = null;
      }
    };

    // 处理文件上传
    const handleUpload = ({file}) => {
      if (selectedModelId.value === null) {
        message.error('请先选择一个模型');
        return;
      }

      uploading.value = true; // 显示上传按态

      // 清空历史消息
      queryVectorMessageStore.messages = [];

      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target.result;
        parseSqlFile(fileContent);
      };
      reader.readAsText(file);
    };

    // 解析SQL文件内容
    const parseSqlFile = async (fileContent) => {

      // 创建一个system的message，根据数据库信息生成
      const databaseInfo = await loadColumnsByDatabaseId(selectedDatabaseId.value);
      // fixme 验证一下是否可以
      const systemMessage = databaseCreateMarkdown(databaseInfo);
      queryVectorMessageStore.addMessage('system', systemMessage);


      const prompt = `请将以下非标准SQL文件QL语句，并返回JSON格式：[{queryText:...,res..}],resultText表示sql语句,queryText是sql对题使用中文,：\n\n${fileContent}`;
      queryVectorMessageStore.addMessage('user', prompt);
      await queryVectorMessageStore.processResponse(queryVectorMessageStore.messages, queryVectorMessageStore.messages.length - 1, false);
      const aiResponse = queryVectorMessageStore.messages[queryVectorMessageStore.messages.length - 1].content;
      try {
        queryVectors.value = extractJsonFromResponse(aiResponse);
      } catch (error) {
        message.error('解析失败:');
        console.error(error);
      } finally {
        uploading.value = false; // 隐藏上传加载状态
      }
    };

    function extractJsonFromResponse(response) {
      // 使用正则表达式匹配JSON部分
      const jsonRegex = /```json\n([\s\S]*?)\n```/;
      const match = response.match(jsonRegex);

      if (match && match[1]) {
        try {
          // 解析匹配到的JSON字符串
          return JSON.parse(match[1]);
        } catch (error) {
          console.error('解析JSON失败:', error);
          return null;
        }
      } else {
        console.error('未找到有效的JSON内容');
        return null;
      }
    }

    // 根据数据库ID加载相应的表信息
    const loadTablesByDatabaseId = async (databaseId) => {
      const res = await post('/tables/getAllByDatabaseId', {databaseInfoId: databaseId});
      if (res?.success) {
        return res.data;
      } else {
        console.error('加载表信息失败:', res);
        return [];
      }
    };
    // 根据表ID加载相应的列信息
    const loadColumnsByTableId = async (tableId) => {
      const res = await post('/columns/getAllByTableId', {tableInfoId: tableId});
      if (res?.success) {
        return res.data;
      } else {
        console.error('加载列信息失败:', res);
        return [];
      }
    };
    // 根据数据库ID加载相应的列信息
    const loadColumnsByDatabaseId = async (databaseId) => {
      const [tables, database] = await Promise.all([
        loadTablesByDatabaseId(databaseId),
        databases.value.find(db => db.databaseInfoId === databaseId)
      ]);
      const tablesWithColumns = await Promise.all(tables.map(async table => ({
        ...table,
        columns: await loadColumnsByTableId(table.tableInfoId)
      })));

      return {
        ...database,
        key: String(databaseId),
        tables: tablesWithColumns
      };
    };

    // 生成数据库Markdown
    const databaseCreateMarkdown = (database) => {
      let markdown = `领域:数据分析,数据库类型:${database.databaseType}\n\n`;
      markdown += `### 数据库名字: ${database.databaseName}`;
      if (database.databaseDescription) {
        markdown += `**说明**: ${database.databaseDescription}`;
      }
      markdown += '\n';
      database.tables.forEach((table) => {
        markdown += `#### 表名: ${table.tableName} `;
        if (table.tableComment) {
          markdown += `**注释**: ${table.tableComment} `;
        }
        if (table.tableDescription) {
          markdown += `**说明**: ${table.tableDescription}`;
        }
        markdown += '\n';

        table.columns.forEach((column) => {
          markdown += `- **字段名**: ${column.columnName}`;
          if (column.columnComment) {
            markdown += ` **注释**: ${column.columnComment}`;
          }
          if (column.columnDescription) {
            markdown += ` **说明**: ${column.columnDescription}`;
          }
          markdown += '\n';
        });
        markdown += '\n';
      });
      return markdown;
    };

    // 处理文件状态变化
    const handleChange = (info) => {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 文件解析成功`);
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 文解析失败`);
        uploading.value = false; // 隐藏上传加载状态
      }
    };

    // 批量提交向量信息
    const onSubmit = async () => {
      if (queryVectors.value.length === 0) {
        message.warning('没有可提交的向量信息');
        return;
      }

      // 拼接参数
      const formattedQueryVectors = queryVectors.value.map(vector => ({
        databaseInfoId: selectedDatabaseId.value,
        userId: userStore.userData.userId,
        queryText: vector.queryText,
        resultText: vector.resultText,
        success: true
      }));

      try {
        const response = await post('/queryVectors/batchImport', formattedQueryVectors);
        if (response && response.success) {
          message.success('向量批量导入成功');
          emit('onCancel');
          queryVectors.value = []; // 清空已的向量信息
        } else {
          message.error('向量批量导入失败');
        }
      } catch (error) {
        message.error('向量批量导入失败');
        console.error(error);
      }
    };

    // 取消操作
    const onCancel = () => {
      emit('onCancel');
    };

    onMounted(() => {
      loadDatabases();
    });

    return {
      columns,
      databases,
      treeData,
      selectedDatabaseId,
      modelOptions,
      selectedModelId,
      queryVectors,
      handleModelChange,
      handleUpload,
      handleChange,
      fileList, // 返回 fileList
      uploading, // 返回 uploading
      onSubmit,
      queryVectorMessageStore,
      onCancel
    };
  }
}
</script>


<style scoped>
.top-box {
  display: flex;
  align-items: center;
}

.sqlUpdate {
  display: flex;
  align-items: center;
  margin-left: 5%;
  cursor: pointer;
}

.table-container {
  margin-top: 2%;
  max-height: 400px;
  overflow-y: auto;
}

.table {
  width: 100%;
}
</style>
