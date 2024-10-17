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
import {ref, onMounted, computed, watch, onUpdated, onBeforeUnmount} from 'vue';
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

    const treeData = ref([]);
    const analyzingStates = ref(new Map());

    // 初始化tree
    onMounted(async () => {
      const {currentProjectPath,sessionId} = currentSession.value;
      const structure = await ipcRenderer.invoke('getDirectoryStructure', currentProjectPath,sessionId);
      treeData.value = sortTreeData([structure]);
      updateSessionMessages();
      // 监控目录
      ipcRenderer.invoke('initDirectoryWatch', currentProjectPath);
      ipcRenderer.on(currentProjectPath, (event, {action, fileInfo}) => {
        if (action === 'add' || action === 'addDir') {
          addNodeToTree(treeData.value, fileInfo);
        } else if (action === 'change') {
          updateNodeInTree(treeData.value, fileInfo);
        } else if (action === 'unlink' || action === 'unlinkDir') {
          removeNodeFromTree(treeData.value, fileInfo);
        }
      });
    });
    // 取消监控
    onBeforeUnmount(() => {
      const {currentProjectPath,sessionId} = currentSession.value;
      ipcRenderer.invoke('removeDirectoryWatch', currentProjectPath,sessionId);
    });

    const sortTreeData = (nodes) => {
      const directories = nodes.filter(node => node.type === 'directory');
      const files = nodes.filter(node => node.type === 'file');
      directories.sort((a, b) => a.title.localeCompare(b.title));
      files.sort((a, b) => a.title.localeCompare(b.title));
      directories.forEach(dir => dir.children && (dir.children = sortTreeData(dir.children)));
      return [...directories, ...files];
    };

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

    const addNodeToTree = (nodes, fileInfo) => {
      const parentPath = fileInfo.key.split('/').slice(0, -1).join('/');
      const parentNode = findNodeByKey(nodes, parentPath);
      if (parentNode && parentNode.children) {
        parentNode.children.push({...fileInfo, children: [], type: fileInfo.type});
      } else if (!parentNode) {
        nodes.push({...fileInfo, children: [], type: fileInfo.type});
      }
    };

    const updateNodeInTree = (nodes, fileInfo) => {
      const node = findNodeByKey(nodes, fileInfo.key);
      if (node) {
        node.title = fileInfo.title;
        node.modified = fileInfo.modified;
      }
    };

    const removeNodeFromTree = (nodes, fileInfo) => {
      const parentPath = fileInfo.key.split('/').slice(0, -1).join('/');
      const parentNode = findNodeByKey(nodes, parentPath);
      if (parentNode && parentNode.children) {
        parentNode.children = parentNode.children.filter(child => child.key !== fileInfo.key);
      } else {
        const nodeIndex = nodes.findIndex(node => node.key === fileInfo.key);
        if (nodeIndex !== -1) nodes.splice(nodeIndex, 1);
      }
    };

    const isAnalyzing = (key) => analyzingStates.value.get(key);

    const onContextMenuClick = (nodeData, menuKey) => {
      if (menuKey === 'update') {
        message.success(`更新 ${nodeData.title} 成功`);
      } else if (menuKey === 'delete') {
        removeNodeFromTree(treeData.value, nodeData);
        message.success(`${nodeData.title} 已删除`);
      }
    };

    const onSelect = (checkedKeysValue, {selectedNodes}) => {
      const fileNodes = selectedNodes.filter(node => node.type === 'file');
      currentSession.value.currentSelectFile = fileNodes.map(node => node.key);
    };

    const updateSessionMessages = () => {
      if (currentSession.value?.currentSelectFile?.length === 0) {
        const filterTreeData = (node, isRoot = false) => ({
          name: node.title,
          ...(isRoot && {path: node.key}),
          ...(node.type !== 'file' && node.children && {children: node.children.map(child => filterTreeData(child))}),
        });

        const filteredTreeData = treeData.value.map(node => filterTreeData(node, true));
        if (currentSession.value) {
          currentSession.value.messages = [
            {
              role: 'system',
              content: JSON.stringify(filteredTreeData[0]),
            },
          ];
        }
      }
    };

    watch(
        () => currentSession.value?.currentSelectFile,
        () => updateSessionMessages(),
        {immediate: true}
    );

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
