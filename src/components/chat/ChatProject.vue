<template>
  <div>
    <a-directory-tree
        :treeData="treeData"
        :fieldNames="{children:'children', title:'name', key:'path' }"
        :checkable="false"
        :defaultExpandAll="true"
        :selectable="true"
        :multiple="true"
        :showLine="false"
        :selectedKeys="currentSession.currentSelectNode"
        @select="onSelect"
    >
      <template #title="{ data }">
        <a-dropdown :trigger="['contextmenu']">
          <span>{{ data.name }}</span>
          <template #overlay>
            <a-menu @click="({ key: menuKey }) => onContextMenuClick(data, menuKey)">
              <a-menu-item key="update">{{ data.type === 'file' ? '更新' : '更新目录' }}</a-menu-item>
              <a-menu-item key="delete">删除</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <custom-loading v-if="isAnalyzing(data.key)"/>
      </template>
    </a-directory-tree>
  </div>
</template>

<script>
import {ref, onMounted, computed} from 'vue';
import {message} from 'ant-design-vue';
import CustomLoading from '@/components/common/CustomLoading.vue';
import {useSessionStore} from "@/store/SessionStore";

const {ipcRenderer} = require('electron');

export default {
  props: {selectedSessionId: {required: true}},
  components: {CustomLoading},
  setup(props) {

    const sessionStore = useSessionStore();

    const currentSession = computed(() => {
      return sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null;
    });

    const treeData = ref([]); // 用于存储文件目录树的状态
    const analyzingStates = ref(new Map());

    // 当组件挂载时启动文件夹监听
    onMounted(async () => {
      const directoryPath = currentSession.value.currentPath

      // 获取目录结构
      const structure = await ipcRenderer.invoke('get-directory-structure', directoryPath);
      treeData.value = [structure];
      // 启动监听文件目录
      ipcRenderer.invoke('start-watching', directoryPath);

      // 监听文件变化事件
      ipcRenderer.on('file-changed', (event, {action, fileInfo}) => {
        if (action === 'add') {
          addNodeToTree(treeData.value, fileInfo);
        } else if (action === 'change') {
          updateNodeInTree(treeData.value, fileInfo);
        } else if (action === 'unlink') {
          removeNodeFromTree(treeData.value, fileInfo);
        }
      });
    });

    // 根据 key 查找节点
    const findNodeByKey = (nodes, key) => {
      for (const node of nodes) {
        if (node.key === key) return node;
        if (node.children) {
          const result = findNodeByKey(node.children, key);
          if (result) return result;
        }
      }
      return null;
    };

    // 添加节点
    const addNodeToTree = (nodes, fileInfo) => {
      const parentPath = fileInfo.path.split('/').slice(0, -1).join('/');
      const parentNode = findNodeByKey(nodes, parentPath);
      if (parentNode && parentNode.children) {
        parentNode.children.push({
          title: fileInfo.name,
          key: fileInfo.path,
          type: fileInfo.type,
          isLeaf: fileInfo.type === 'file',
          children: []
        });
      } else if (!parentNode) {
        nodes.push({
          title: fileInfo.name,
          key: fileInfo.path,
          type: fileInfo.type,
          isLeaf: fileInfo.type === 'file',
          children: []
        });
      }
    };

    // 更新节点
    const updateNodeInTree = (nodes, fileInfo) => {
      const node = findNodeByKey(nodes, fileInfo.path);
      if (node) {
        node.title = fileInfo.name;
        node.modified = fileInfo.modified;
      }
    };

    // 删除节点
    const removeNodeFromTree = (nodes, fileInfo) => {
      const parentPath = fileInfo.path.split('/').slice(0, -1).join('/');
      const parentNode = findNodeByKey(nodes, parentPath);
      if (parentNode && parentNode.children) {
        parentNode.children = parentNode.children.filter(child => child.key !== fileInfo.path);
      } else {
        const nodeIndex = nodes.findIndex(node => node.key === fileInfo.path);
        if (nodeIndex !== -1) {
          nodes.splice(nodeIndex, 1);
        }
      }
    };

    // 判断是否正在分析
    const isAnalyzing = (key) => analyzingStates.value.get(key);

    // 处理右键菜单点击事件
    const onContextMenuClick = (nodeData, menuKey) => {
      if (menuKey === 'update') {
        message.success(`更新 ${nodeData.title}`);
      } else if (menuKey === 'delete') {
        removeNodeFromTree(treeData.value, nodeData);
        message.success(`${nodeData.title} 已删除`);
      }
    };


    const onSelect = (checkedKeysValue, { selectedNodes }) => {
      // 处理选中的文件节点
      const fileNodes = selectedNodes.filter(node => node.type === 'file');
      currentSession.value.currentSelectNode = fileNodes.map(node => node.path);
      currentSession.value.messages[0].content = `\`\`\`json\n${JSON.stringify(fileNodes, null, 2)}\n\`\`\``;
    };

    return {
      treeData,
      currentSession,
      isAnalyzing,
      onContextMenuClick,
      onSelect
    };
  }
};
</script>

<style scoped>
:deep(.ant-tree-node-content-wrapper) {
  display: flex;
}

:deep(.ant-tree-directory) {
  position: absolute;
  height: 100%;
  width: 100%;
  background-color: #f5f5f5;
  overflow: scroll;
}
</style>
