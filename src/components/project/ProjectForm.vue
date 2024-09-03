<template>
  <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 14 }"
  >
    <a-form-item label="项目名称" name="projectName">
      <a-input v-model:value="formState.projectName" placeholder="请输入项目名称"/>
    </a-form-item>

    <a-form-item label="项目目录" name="projectPath">
      <div>
        <a-input v-model:value="formState.projectPath" placeholder="请选择项目目录" readonly/>
        <a-button type="primary" @click="selectDirectory">选择目录</a-button>
        <input type="file" ref="fileInput" style="display: none;" webkitdirectory @change="handleDirectorySelection"/>
      </div>
    </a-form-item>

    <a-form-item label="项目描述" name="projectDescription">
      <a-textarea v-model:value="formState.projectDescription" placeholder="请输入项目描述"/>
    </a-form-item>

    <a-form-item :wrapper-col="{ span: 20, offset: 6 }">
      <a-button type="primary" @click="onSubmit">确认</a-button>
      <a-button style="margin-left: 10px" @click="onCancel">取消</a-button>
    </a-form-item>
  </a-form>
</template>

<script>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useProjectStore } from '@/store/ProjectStore'; // 引入 ProjectStore

export default {
  props: {
    initialValues: {
      type: Object,
      default: () => ({}),
    },
    mode: {
      type: String,
      default: 'add',
    },
  },
  setup(props, { emit }) {
    const projectStore = useProjectStore(); // 使用 ProjectStore
    const formRef = ref(null);
    const formState = reactive({
      projectName: '',
      projectPath: '',
      projectDescription: '',
    });

    const rules = computed(() => ({
      projectName: [
        { required: true, message: '请输入项目名称', trigger: 'blur' },
      ],
      projectPath: [
        { required: true, message: '请选择项目目录', trigger: 'blur' },
      ],
      projectDescription: [
        { required: true, message: '请输入项目描述', trigger: 'blur' },
      ],
    }));

    watch(
        () => props.initialValues,
        (newVal) => {
          if (newVal) {
            formState.projectName = newVal.projectName || '';
            formState.projectPath = newVal.projectPath || '';
            formState.projectDescription = newVal.projectDescription || '';
          }
        },
        { immediate: true }
    );

    const selectDirectory = () => {
      const fileInput = document.querySelector('input[type="file"][webkitdirectory]');
      fileInput.click();
    };

    const handleDirectorySelection = (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        const path = files[0].webkitRelativePath;
        const directoryPath = path.substring(0, path.indexOf('/'));
        formState.projectPath = directoryPath;
      }
    };

    const onSubmit = async () => {
      try {
        await formRef.value.validate();
        const data = { ...formState };

        if (props.mode === 'add') {
          projectStore.addProject(data); // 使用 ProjectStore 添加项目
        } else {
          data.projectId = props.initialValues.projectId;
          projectStore.updateProject(data); // 使用 ProjectStore 更新项目
        }

        emit('onCancel');
      } catch (error) {
        console.error('Validation failed:', error);
      }
    };

    const onCancel = () => {
      emit('onCancel');
    };

    onMounted(() => {
      if (props.initialValues) {
        Object.assign(formState, props.initialValues);
      }
    });

    return {
      formRef,
      formState,
      rules,
      onSubmit,
      onCancel,
      selectDirectory,
      handleDirectorySelection,
    };
  },
};
</script>

<style scoped>
</style>
