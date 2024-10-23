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
            <a-menu-item key="addDir">新增目录</a-menu-item>
            <a-menu-item key="addFile">新增文件</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
      <custom-loading v-if="isAnalyzing(data.key)"/>
    </template>
  </a-directory-tree>
  <a-modal :mask="false" v-model:open="modalVisible" title="输入名称" @ok="handleModalOk" @cancel="handleModalCancel">
    <a-input v-model:value="newName" placeholder="请输入名称"/>
  </a-modal>
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
    const modalVisible = ref(false);
    const newName = ref('');
    const currentNode = ref(null);
    const actionType = ref('');

    // 初始化tree
    onMounted(async () => {
      const {currentProjectPath, sessionId} = currentSession.value;
      const structure = await ipcRenderer.invoke('getDirectoryStructure', currentProjectPath);
      treeData.value = sortTreeData([structure]);
      updateSessionMessages();
      // 监控目录
      ipcRenderer.invoke('initDirectoryWatch', currentProjectPath, sessionId);
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
      const {currentProjectPath, sessionId} = currentSession.value;
      ipcRenderer.invoke('removeDirectoryWatch', currentProjectPath, sessionId);
    });

    const sortTreeData = (nodes) => {
      const filterNodes = (node) => node.title && (node.type === 'directory' ? node.title[0] !== '.' : true);

      const directories = nodes.filter(node => node.type === 'directory' && filterNodes(node));
      const files = nodes.filter(node => node.type === 'file' && filterNodes(node));
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
      } else if (menuKey === 'addDir' || menuKey === 'addFile') {
        currentNode.value = nodeData;
        actionType.value = menuKey;
        modalVisible.value = true;
      }
    };

    const handleModalOk = async () => {
      const {currentProjectPath} = currentSession.value;
      const fullPath = `${currentNode.value.key}/${newName.value}`;
      if (actionType.value === 'addDir') {
        await ipcRenderer.invoke('createDirectory', fullPath);
      } else if (actionType.value === 'addFile') {
        await ipcRenderer.invoke('createFile', fullPath);
      }
      modalVisible.value = false;
      newName.value = '';
      const fileInfo = {
        key: fullPath,
        title: newName.value,
        type: actionType.value === 'addDir' ? 'directory' : 'file'
      };
      addNodeToTree(treeData.value, fileInfo);
    };

    const handleModalCancel = () => {
      modalVisible.value = false;
      newName.value = '';
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
          currentSession.value.messages[1] = {
            role: 'user',
            content: JSON.stringify(filteredTreeData[0]),
          };
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
      onSelect,
      modalVisible,
      newName,
      handleModalOk,
      handleModalCancel
    };
  }
};
</script>
<style>
.chat-tree {
  background-color: #F7F8FAFF;
  height: 100%; /* 自适应父组件高度 */
  overflow: auto; /* 超出时显示滚动条 */
}
</style>
