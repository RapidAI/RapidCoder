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
    <!-- 自定义节点 title + 右键菜单 -->
    <template #title="{ data }">
      <a-dropdown :trigger="['contextmenu']">
        <span>{{ data.title }}</span>
        <template #overlay>
          <a-menu @click="({ key: menuKey }) => onContextMenuClick(data, menuKey)">
            <a-menu-item key="update">
              {{ data.type === 'file' ? '更新' : '更新目录' }}
            </a-menu-item>
            <a-menu-item key="rename">重命名</a-menu-item>
            <a-menu-item key="delete">删除</a-menu-item>
            <a-menu-item key="addDir">新增目录</a-menu-item>
            <a-menu-item key="addFile">新增文件</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
      <!-- 文件或目录在分析时的加载动画 -->
      <custom-loading v-if="isAnalyzing(data.key)"/>
    </template>
  </a-directory-tree>

  <!-- 重命名 / 新增文件或目录 时使用的Modal -->
  <a-modal
      :mask="false"
      v-model:open="modalVisible"
      title="输入名称"
      @ok="handleModalOk"
      @cancel="handleModalCancel"
  >
    <a-input
        ref="nameInput"
        v-model:value="newName"
        placeholder="请输入名称"
        @keyup.enter="handleModalOk"
    />
  </a-modal>
</template>

<script>
import { ref, onMounted, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { message } from 'ant-design-vue';
import CustomLoading from '@/components/common/CustomLoading.vue';
import { useSessionStore } from '@/store/SessionStore';

const { ipcRenderer } = require('electron');

export default {
  props: {
    selectedSessionId: { required: true },
  },
  components: {
    CustomLoading,
  },
  setup(props) {
    const sessionStore = useSessionStore();
    const currentSession = computed(
        () => sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null
    );

    const treeData = ref([]);
    const loading = ref(true);

    // ====== 新增/重命名 Modal 相关 ======
    const modalVisible = ref(false);
    const newName = ref('');
    const currentNode = ref(null);
    const actionType = ref('');
    const nameInput = ref(null);

    // ====== 记录哪些文件/目录在 “分析中” ======
    const analyzingStates = ref(new Map());
    const isAnalyzing = (key) => analyzingStates.value.get(key);

    // 当 Modal 显示时，下一个 tick 聚焦输入框
    watch(modalVisible, async (newVal) => {
      if (newVal) {
        await nextTick();
        nameInput.value?.focus();
      }
    });

    // ====== 监听器：需要在 onMounted 中注册，在 onBeforeUnmount 中移除 ======
    let directoryListener = null;

    // 组件挂载时加载目录结构，并启动监听
    onMounted(async () => {
      // 如果 currentSession 本身不存在（比如 tab 已被删除，或 ID 无效），需要做防护
      if (!currentSession.value) {
        loading.value = false;
        return;
      }

      try {
        loading.value = true;
        const { currentProjectPath, sessionId } = currentSession.value;

        // 1. 获取初始目录结构
        const structure = await ipcRenderer.invoke('getDirectoryStructure', currentProjectPath);
        treeData.value = sortTreeData([structure]);
        loading.value = false;

        // 2. 初始化 watch
        ipcRenderer.invoke('initDirectoryWatch', currentProjectPath, sessionId);

        // 3. 注册监听器，需要在 beforeUnmount 时 .off
        directoryListener = (event, { action, fileInfo }) => {
          updateTree(treeData.value, fileInfo, action);
        };
        ipcRenderer.on(currentProjectPath, directoryListener);

        // 更新消息
        updateSessionMessages();
      } catch (err) {
        loading.value = false;
        console.error('onMounted error in ChatTree:', err);
        message.error('加载目录结构时出错');
      }
    });

    // 组件卸载前移除监听器，并通知主进程停止 watch
    onBeforeUnmount(() => {
      // 如果 currentSession 或 directoryListener 已经为空，则跳过
      const session = currentSession.value;
      if (!session) return;

      const { currentProjectPath, sessionId } = session;
      if (directoryListener) {
        // 移除对 currentProjectPath 频道的监听，避免组件卸载后仍然触发 updateTree
        ipcRenderer.off(currentProjectPath, directoryListener);
      }

      // 调用 removeDirectoryWatch 时，最好用 try/catch 或 .catch
      if (currentProjectPath && sessionId) {
        ipcRenderer
            .invoke('removeDirectoryWatch', currentProjectPath, sessionId)
            .catch((err) => {
              console.error('removeDirectoryWatch error:', err);
            });
      }
    });

    // ====== 排序目录与文件，隐藏以 . 开头的目录/文件等 ======
    const sortTreeData = (nodes) => {
      const filterNodes = (node) =>
          node.title && (node.type === 'directory' ? node.title[0] !== '.' : true);

      const directories = nodes
          .filter((node) => node.type === 'directory' && filterNodes(node))
          .sort((a, b) => a.title.localeCompare(b.title));
      const files = nodes
          .filter((node) => node.type === 'file' && filterNodes(node))
          .sort((a, b) => a.title.localeCompare(b.title));

      directories.forEach((dir) => {
        if (dir.children) {
          dir.children = sortTreeData(dir.children);
        }
      });

      return [...directories, ...files];
    };

    // ====== 递归查找节点 ======
    const findNodeByKey = (nodes, key) => {
      for (const node of nodes) {
        if (node.key === key) {
          return node;
        }
        if (node.children) {
          const found = findNodeByKey(node.children, key);
          if (found) return found;
        }
      }
      return null;
    };

    // ====== 根据 action 更新 treeData（add / update / remove） ======
    const updateTree = (nodes, fileInfo, action) => {
      const parentPath = fileInfo.key.split('/').slice(0, -1).join('/');
      const parentNode = findNodeByKey(nodes, parentPath);

      if (action === 'add') {
        // 新增文件/目录
        (parentNode?.children || nodes).push({
          ...fileInfo,
          children: [],
          type: fileInfo.type,
        });
      } else if (action === 'update') {
        // 修改（重命名等）
        const node = findNodeByKey(nodes, fileInfo.key);
        if (node) {
          node.title = fileInfo.title;
          node.modified = fileInfo.modified;
        }
      } else if (action === 'remove') {
        // 删除
        if (parentNode && parentNode.children) {
          parentNode.children = parentNode.children.filter(child => child.key !== fileInfo.key);
        } else {
          const nodeIndex = nodes.findIndex(node => node.key === fileInfo.key);
          if (nodeIndex !== -1) nodes.splice(nodeIndex, 1);
        }
      }
    };

    // ====== 右键菜单点击 ======
    const onContextMenuClick = (nodeData, menuKey) => {
      if (menuKey === 'update') {
        message.success(`更新 ${nodeData.title} 成功`);
      } else if (menuKey === 'rename') {
        currentNode.value = nodeData;
        actionType.value = 'rename';
        newName.value = nodeData.title;
        modalVisible.value = true;
      } else if (menuKey === 'delete') {
        const method = nodeData.type === 'file' ? 'deleteFile' : 'deleteDirectory';
        ipcRenderer.invoke(method, nodeData.key).then((response) => {
          if (response.success) {
            updateTree(treeData.value, nodeData, 'remove');
            message.success(`${nodeData.title} 已删除`);
          } else {
            message.error(response.message);
          }
        });
      } else if (['addDir', 'addFile'].includes(menuKey)) {
        // 新增目录 / 文件
        currentNode.value = nodeData;
        const parentKey =
            nodeData.type === 'file'
                ? nodeData.key.split('/').slice(0, -1).join('/')
                : nodeData.key;
        actionType.value = menuKey;
        modalVisible.value = true;
        currentNode.value.key = parentKey;
      }
    };

    // ====== Modal 确认 ======
    const handleModalOk = async () => {
      if (!currentSession.value) {
        // 如果在操作期间 session 已被关闭
        modalVisible.value = false;
        return;
      }
      const {currentProjectPath} = currentSession.value;

      try {
        if (actionType.value === 'rename') {
          const oldPath = currentNode.value.key;
          const newPath = `${oldPath.split('/').slice(0, -1).join('/')}/${newName.value}`;
          await ipcRenderer.invoke('renameFileOrDirectory', oldPath, newPath);
          updateTree(treeData.value, {key: oldPath, title: newName.value}, 'update');
        } else {
          // addDir / addFile
          const fullPath = `${currentNode.value.key}/${newName.value}`;
          const method = actionType.value === 'addDir' ? 'createDirectory' : 'createFile';
          await ipcRenderer.invoke(method, fullPath);
        }
        message.success(`操作成功: ${newName.value}`);
      } catch (err) {
        console.error('handleModalOk error:', err);
        message.error('操作失败，请检查日志或路径');
      }

      modalVisible.value = false;
      newName.value = '';
    };

    // ====== Modal 取消 ======
    const handleModalCancel = () => {
      modalVisible.value = false;
      newName.value = '';
    };

    // ====== 树选择事件 ======
    const onSelect = (checkedKeysValue, {selectedNodes}) => {
      // 只记录选中的文件 key
      currentSession.value.currentSelectFile = selectedNodes
          .filter(node => node.type === 'file')
          .map(node => node.key);
    };

    // ====== 更新 sessionStore 里的一条消息，用于存储完整目录结构 ======
    const updateSessionMessages = () => {
      if (!currentSession.value) return;

      if (currentSession.value.currentSelectFile?.length === 0) {
        const filterTreeData = (node, isRoot = false) => ({
          name: node.title,
          ...(isRoot && {path: node.key}),
          ...(node.type !== 'file' && node.children
                  ? {children: node.children.map(child => filterTreeData(child))}
                  : {}
          ),
        });
        const filteredTreeData = treeData.value.map(node => filterTreeData(node, true));
        const contentToUpdate = filteredTreeData.length > 0 ? JSON.stringify(filteredTreeData[0]) : '';

        if (contentToUpdate) {
          currentSession.value.messages[1] = {
            role: 'user',
            content: contentToUpdate,
          };
        }
      }
    };

    // 监听文件选择变化、实时更新
    watch(
        () => currentSession.value?.currentSelectFile,
        () => updateSessionMessages(),
        {immediate: true}
    );

    return {
      treeData,
      loading,
      // Modal
      modalVisible,
      newName,
      nameInput,
      // Computed
      currentSession,
      // Methods
      isAnalyzing,
      onContextMenuClick,
      onSelect,
      handleModalOk,
      handleModalCancel,
    };
  },
};
</script>

<style>
.chat-tree {
  background-color: #F7F8FAFF;
  height: 100%;
  overflow: auto;
}

/* 防止目录或文件名过长换行，可视情况调整 */
:where(.css-dev-only-do-not-override-nqguil).ant-tree.ant-tree-directory .ant-tree-treenode {
  white-space: nowrap;
}
</style>