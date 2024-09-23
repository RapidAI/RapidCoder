<template>
  <div>
    <a-tree
        :treeData="treeData"
        :defaultExpandAll="false"
        :showLine="{ showLeafIcon: false }"
        :checkedKeys="messageStore.databaseInfoCheked"
        checkable
        @check="onCheck"/>
  </div>
</template>

<script>
import {ref, watch, computed} from 'vue'
import {useMessageStore} from '@/store/MessageStore.js'

export default {
  props: {
    markdown: {type: String, default: ''},
    messageindex: {type: Number, default: 0},
    selectedSessionId: {
      required: true,
    },
  },
  setup(props) {
    const messageStore = useMessageStore()
    const treeData = ref([])
    const currentSession = computed(() => {
      return messageStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null;
    });


    // 格式化数据库信息以适应树形结构
    const formatTreeData = () => {
      if (!currentSession.value) {
        console.error('currentSession is null');
        return;
      }

      const content = currentSession.value.messages[0].content;
      const match = content.match(/```json\n([\s\S]*?)\n```/);

      if (!match || !match[1]) {
        console.error('未在内容中找到 JSON 数据');
        return;
      }

      let jsonData;
      try {
        jsonData = JSON.parse(match[1]);
      } catch (e) {
        console.error('解析 JSON 失败:', e);
        return;
      }

      // 检查 jsonData 是否是数组
      if (!Array.isArray(jsonData)) {
        console.error('jsonData 不是一个数组');
        return;
      }

      // 构建 treeData
      treeData.value = jsonData.map((project, projectIndex) => {
        return {
          title: project.projectName || `项目${projectIndex + 1}`,
          key: `project-${project.projectId || projectIndex}`,
          children: [
            {
              title: `项目路径: ${project.projectPath}`,
              key: `project-${project.projectId || projectIndex}-path`,
            },
            {
              title: `项目描述: ${project.projectDescription}`,
              key: `project-${project.projectId || projectIndex}-description`,
            },
            {
              title: `项目ID: ${project.projectId}`,
              key: `project-${project.projectId || projectIndex}-id`,
            },
            // 处理 projectFileDetails
            {
              title: '项目文件详情',
              key: `project-${project.projectId || projectIndex}-fileDetails`,
              children: Object.keys(project.projectFileDetails || {}).map(filePath => {
                const fileDetails = project.projectFileDetails[filePath];
                return {
                  title: filePath,
                  key: `project-${project.projectId || projectIndex}-file-${filePath}`,
                  children: Object.keys(fileDetails).map(detailKey => {
                    const detailValue = fileDetails[detailKey];
                    if (Array.isArray(detailValue)) {
                      // detailValue 是数组
                      return {
                        title: detailKey,
                        key: `project-${project.projectId || projectIndex}-file-${filePath}-${detailKey}`,
                        children: detailValue.map((item, index) => ({
                          title: item,
                          key: `project-${project.projectId || projectIndex}-file-${filePath}-${detailKey}-${index}`,
                        })),
                      };
                    } else if (typeof detailValue === 'object' && detailValue !== null) {
                      // detailValue 是对象
                      return {
                        title: detailKey,
                        key: `project-${project.projectId || projectIndex}-file-${filePath}-${detailKey}`,
                        children: Object.keys(detailValue).map(subKey => ({
                          title: `${subKey}: ${detailValue[subKey]}`,
                          key: `project-${project.projectId || projectIndex}-file-${filePath}-${detailKey}-${subKey}`,
                        })),
                      };
                    } else {
                      // detailValue 是其他类型
                      return {
                        title: `${detailKey}: ${detailValue}`,
                        key: `project-${project.projectId || projectIndex}-file-${filePath}-${detailKey}`,
                      };
                    }
                  }),
                };
              }),
            },
          ],
        };
      });

      console.log('Final treeData:', treeData.value);
    };




    // 当选中状态变化时的处理函数
    const onCheck = (checkedKeysValue) => {
    }

    watch(() => props.selectedSessionId, formatTreeData, {immediate: true});


    return {
      treeData,
      onCheck,
      messageStore,
    }
  },
}
</script>

<style scoped>
/* 添加一些样式以更好地展示树形结构 */
.ant-tree {
  background: #f5f5f5;
  padding: 20px;
}
</style>
