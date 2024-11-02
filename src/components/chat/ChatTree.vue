<template>
  <div v-if="loading">
    <custom-loading/>
  </div>
  <a-directory-tree
      v-else
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
    <a-input
        ref="nameInput"
        v-model:value="newName"
        placeholder="请输入名称"
        @keyup.enter="handleModalOk"
    />
  </a-modal>
</template>

<script>
import {ref, onMounted, computed, watch, nextTick, onBeforeUnmount} from 'vue';
import {message} from 'ant-design-vue';
import CustomLoading from '@/components/common/CustomLoading.vue';
import {useSessionStore} from "@/store/SessionStore";

const {ipcRenderer} = require('electron');

export default {
  props: {selectedSessionId: {required: true}},
  components: {CustomLoading},
  setup(props) {
    const sessionStore = useSessionStore();
    const currentSession = computed(() => sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null);
    const treeData = ref([]);
    const loading = ref(true);
    const modalVisible = ref(false);
    const newName = ref('');
    const currentNode = ref(null);
    const actionType = ref('');
    const analyzingStates = ref(new Map());
    const nameInput = ref(null);
    watch(modalVisible, async (newVal) => {
      if (newVal) {
        await nextTick();
        nameInput.value?.focus();
      }
    });
    const sortTreeData = (nodes) => {
      const filterNodes = (node) => node.title && (node.type === 'directory' ? node.title[0] !== '.' : true);
      const directories = nodes.filter(node => node.type === 'directory' && filterNodes(node)).sort((a, b) => a.title.localeCompare(b.title));
      const files = nodes.filter(node => node.type === 'file' && filterNodes(node)).sort((a, b) => a.title.localeCompare(b.title));
      directories.forEach(dir => dir.children && (dir.children = sortTreeData(dir.children)));
      return [...directories, ...files];
    };

    const findNodeByKey = (nodes, key) => nodes.reduce((acc, node) => acc || (node.key === key ? node : (node.children ? findNodeByKey(node.children, key) : null)), null);

    const updateTree = (nodes, fileInfo, action) => {
      const parentPath = fileInfo.key.split('/').slice(0, -1).join('/');
      const parentNode = findNodeByKey(nodes, parentPath);
      if (action === 'add') {
        (parentNode?.children || nodes).push({...fileInfo, children: [], type: fileInfo.type});
      } else if (action === 'update') {
        const node = findNodeByKey(nodes, fileInfo.key);
        if (node) {
          node.title = fileInfo.title;
          node.modified = fileInfo.modified;
        }
      } else if (action === 'remove') {
        if (parentNode) {
          parentNode.children = parentNode.children.filter(child => child.key !== fileInfo.key);
        } else {
          const nodeIndex = nodes.findIndex(node => node.key === fileInfo.key);
          if (nodeIndex !== -1) nodes.splice(nodeIndex, 1);
        }
      }
    };

    onMounted(async () => {
      loading.value = true;
      const {currentProjectPath, sessionId} = currentSession.value;
      const structure = await ipcRenderer.invoke('getDirectoryStructure', currentProjectPath);
      treeData.value = sortTreeData([structure]);
      loading.value = false;
      updateSessionMessages();
      ipcRenderer.invoke('initDirectoryWatch', currentProjectPath, sessionId);
      ipcRenderer.on(currentProjectPath, (event, {action, fileInfo}) => updateTree(treeData.value, fileInfo, action));
    });

    onBeforeUnmount(() => {
      const {currentProjectPath, sessionId} = currentSession.value;
      ipcRenderer.invoke('removeDirectoryWatch', currentProjectPath, sessionId);
    });

    const isAnalyzing = (key) => analyzingStates.value.get(key);

    const onContextMenuClick = (nodeData, menuKey) => {
      if (menuKey === 'update') {
        message.success(`更新 ${nodeData.title} 成功`);
      } else if (menuKey === 'delete') {
        const method = nodeData.type === 'file' ? 'deleteFile' : 'deleteDirectory';
        ipcRenderer.invoke(method, nodeData.key).then(response => {
          if (response.success) {
            updateTree(treeData.value, nodeData, 'remove');
            message.success(`${nodeData.title} 已删除`);
          } else {
            message.error(response.message);
          }
        });
      } else if (['addDir', 'addFile'].includes(menuKey)) {
        currentNode.value = nodeData;
        actionType.value = menuKey;
        modalVisible.value = true;
      }
    };

    const handleModalOk = async () => {
      const {currentProjectPath} = currentSession.value;
      const fullPath = `${currentNode.value.key}/${newName.value}`;
      await ipcRenderer.invoke(actionType.value === 'addDir' ? 'createDirectory' : 'createFile', fullPath);
      modalVisible.value = false;
      newName.value = '';
    };

    const handleModalCancel = () => {
      modalVisible.value = false;
      newName.value = '';
    };

    const onSelect = (checkedKeysValue, {selectedNodes}) => {
      currentSession.value.currentSelectFile = selectedNodes.filter(node => node.type === 'file').map(node => node.key);
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
      nameInput,
      handleModalOk,
      handleModalCancel,
      loading
    };
  }
};
</script>
<style>
.chat-tree {
  background-color: #F7F8FAFF;
  height: 100%;
  overflow: auto;
}
</style>
