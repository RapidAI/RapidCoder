<template>
  <a-directory-tree
      class="chat-tree"
      :treeData="treeData"
      :checkable="false"
      v-model:expandedKeys="currentSession.expandedKeys"
      :selectable="true"
      :multiple="true"
      :blockNode="true"
      :showLine="false"
      :selectedKeys="currentSession.currentSelectFile"
      @select="onSelect"
  >
    <template #title="{ data }">
      <a-dropdown :trigger="['contextmenu']">
        <span>{{ data.title }}</span>
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
      const directoryPath = currentSession.value.currentProjectPath;

      // 获取目录结构
      const structure = await ipcRenderer.invoke('getDirectoryStructure', directoryPath);
      treeData.value= sortTreeData([structure]);

      // 启动监听文件目录
      ipcRenderer.invoke('initDirectoryWatch', directoryPath);

      // 监听文件和目录变化事件
      ipcRenderer.on(directoryPath, (event, {action, fileInfo}) => {
        if (action === 'add' || action === 'addDir') {
          addNodeToTree(treeData.value, fileInfo);
        } else if (action === 'change') {
          updateNodeInTree(treeData.value, fileInfo);
        } else if (action === 'unlink' || action === 'unlinkDir') {
          removeNodeFromTree(treeData.value, fileInfo);
        }
      });
    });
    // 排序函数，递归排序子节点，确保目录排在文件前面
    const sortTreeData = (nodes) => {
      // 将节点分为目录和文件
      const directories = nodes.filter(node => node.type === 'directory');
      const files = nodes.filter(node => node.type === 'file');

      // 分别对目录和文件进行字母顺序排序
      directories.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
      files.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

      // 递归排序子节点
      directories.forEach(dir => {
        if (dir.children) {
          dir.children = sortTreeData(dir.children);
        }
      });

      // 合并目录和文件，确保目录在文件之前
      return [...directories, ...files];
    };

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
      const parentPath = fileInfo.key.split('/').slice(0, -1).join('/');
      const parentNode = findNodeByKey(nodes, parentPath);
      if (parentNode && parentNode.children) {
        parentNode.children.push({
          ...fileInfo,
          children: [],
          type: fileInfo.type
        });
      } else if (!parentNode) {
        nodes.push({
          ...fileInfo,
          children: [],
          type: fileInfo.type
        });
      }
    };

    // 更新节点
    const updateNodeInTree = (nodes, fileInfo) => {
      const node = findNodeByKey(nodes, fileInfo.key);
      if (node) {
        node.title = fileInfo.title;
        node.modified = fileInfo.modified;
      }
    };

    // 删除节点
    const removeNodeFromTree = (nodes, fileInfo) => {
      const parentPath = fileInfo.key.split('/').slice(0, -1).join('/');
      const parentNode = findNodeByKey(nodes, parentPath);
      if (parentNode && parentNode.children) {
        parentNode.children = parentNode.children.filter(child => child.key !== fileInfo.key);
      } else {
        const nodeIndex = nodes.findIndex(node => node.key === fileInfo.key);
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
        message.success(`更新 ${nodeData.title} 成功`);
      } else if (menuKey === 'delete') {
        removeNodeFromTree(treeData.value, nodeData);
        message.success(`${nodeData.title} 已删除`);
      }
    };

    // 处理文件选中
    const onSelect = (checkedKeysValue, {selectedNodes}) => {
      // 过滤出文件节点
      const fileNodes = selectedNodes.filter(node => node.type === 'file');
      // 更新 currentSession.currentSelectFile
      currentSession.value.currentSelectFile = fileNodes.map(node => node.key);
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
<style>
.chat-tree {
  background-color: #F7F8FAFF;
  height: 93vh;
  overflow: auto;
}
</style>
