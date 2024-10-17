<template>
  <a-directory-tree
      class="chat-tree"
      :treeData="treeData"
      :expandedKeys="currentSession?.expandedKeys"
      :selectedKeys="currentSession?.currentSelectFile"
      :selectable="true"
      :multiple="true"
      :blockNode="true"
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
      <custom-loading v-if="isAnalyzing(data.key)" />
    </template>
  </a-directory-tree>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue';
import { message } from 'ant-design-vue';
import CustomLoading from '@/components/common/CustomLoading.vue';
import { useSessionStore } from '@/store/SessionStore';
const { ipcRenderer } = require('electron');

export default {
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  components: { CustomLoading },
  setup(props) {
    const sessionStore = useSessionStore();

    const currentSession = computed(() =>
        sessionStore.sessions.find((s) => s.sessionId === props.selectedSessionId)
    );

    const treeData = ref([]);
    const analyzingStates = ref(new Map());

    onMounted(async () => {
      if (!currentSession.value?.currentProjectPath) return;

      const directoryPath = currentSession.value.currentProjectPath;

      const structure = await ipcRenderer.invoke('getDirectoryStructure', directoryPath);
      treeData.value = sortTreeData([structure]);
      updateSessionMessages();
      ipcRenderer.invoke('initDirectoryWatch', directoryPath);

      ipcRenderer.on(directoryPath, (event, { action, fileInfo }) => {
        switch (action) {
          case 'add':
          case 'addDir':
            addNodeToTree(treeData.value, fileInfo);
            break;
          case 'change':
            updateNodeInTree(treeData.value, fileInfo);
            break;
          case 'unlink':
          case 'unlinkDir':
            removeNodeFromTree(treeData.value, fileInfo);
            break;
        }
      });
    });

    const sortTreeData = (nodes) => {
      const directories = nodes.filter((node) => node.type === 'directory').sort(compareNodes);
      const files = nodes.filter((node) => node.type === 'file').sort(compareNodes);

      directories.forEach((dir) => {
        if (dir.children) {
          dir.children = sortTreeData(dir.children);
        }
      });

      return [...directories, ...files];
    };

    const compareNodes = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

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
      const newNode = { ...fileInfo, children: [], type: fileInfo.type };

      if (parentNode?.children) {
        parentNode.children.push(newNode);
      } else {
        nodes.push(newNode);
      }
    };

    const updateNodeInTree = (nodes, fileInfo) => {
      const node = findNodeByKey(nodes, fileInfo.key);
      if (node) {
        Object.assign(node, fileInfo);
      }
    };

    const removeNodeFromTree = (nodes, fileInfo) => {
      const parentPath = fileInfo.key.split('/').slice(0, -1).join('/');
      const parentNode = findNodeByKey(nodes, parentPath);

      if (parentNode?.children) {
        parentNode.children = parentNode.children.filter((child) => child.key !== fileInfo.key);
      } else {
        const index = nodes.findIndex((node) => node.key === fileInfo.key);
        if (index !== -1) nodes.splice(index, 1);
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

    const onSelect = (selectedKeys, { selectedNodes }) => {
      const fileNodes = selectedNodes.filter((node) => node.type === 'file');
      if (currentSession.value) {
        currentSession.value.currentSelectFile = fileNodes.map((node) => node.key);
      }
    };

    const updateSessionMessages = () => {
      if (currentSession.value?.currentSelectFile?.length === 0) {
        const filterTreeData = ({ type, key, children }) => ({
          type,
          path: key,
          ...(children && { children: children.map(filterTreeData) }),
        });

        const filteredTreeData = treeData.value.map(filterTreeData);
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
        () => {
          updateSessionMessages();
        },
        { immediate: true }
    );


    return {
      treeData,
      currentSession,
      isAnalyzing,
      onContextMenuClick,
      onSelect,
    };
  },
};
</script>

<style>
.chat-tree {
  background-color: #f7f8fa;
  height: 93vh;
  overflow: auto;
}
</style>
