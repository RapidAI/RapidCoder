<template>
  <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 14 }"
  >
    <a-form-item label="模型名称" name="modelName">
      <a-input v-model:value="formState.modelName" placeholder="请输入模型名称"/>
    </a-form-item>

    <a-form-item label="API Key" name="apiKey">
      <a-input
          v-model:value="formState.apiKey"
          placeholder="请输入API Key"
          style="width: 400px"
      />
    </a-form-item>

    <a-form-item label="使用代理" name="useProxy">
      <a-switch v-model:checked="formState.useProxy"/>
    </a-form-item>

    <a-form-item label="代理主机" name="proxyHost" v-if="formState.useProxy">
      <a-input v-model:value="formState.proxyHost" placeholder="请输入代理主机地址"/>
    </a-form-item>

    <a-form-item label="代理端口" name="proxyPort" v-if="formState.useProxy">
      <a-input-number v-model:value="formState.proxyPort" placeholder="请输入代理端口"/>
    </a-form-item>

    <a-form-item label="基础URL" name="baseUrl">
      <a-input v-model:value="formState.baseUrl" placeholder="请输入基础URL"/>
    </a-form-item>

    <a-form-item label="模型标识" name="model">
      <a-input v-model:value="formState.model" placeholder="请输入模型标识"/>
    </a-form-item>

    <a-form-item label="描述" name="description">
      <a-textarea v-model:value="formState.description" placeholder="请输入描述信息"/>
    </a-form-item>

    <a-form-item :wrapper-col="{ span: 20, offset: 6 }">
      <a-button type="primary" @click="onSubmit">确认</a-button>
      <a-button style="margin-left: 10px" @click="onCancel">取消</a-button>
    </a-form-item>
  </a-form>
</template>

<script>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { post } from '@/api';

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
    const formRef = ref(null);
    const formState = reactive({
      modelName: '',
      apiKey: '',
      useProxy: false,
      proxyHost: '',
      proxyPort: null,
      baseUrl: '',
      model: '',
      description: '',
    });

    const maskedApiKey = ref('');

    const rules = computed(() => ({
      modelName: [
        { required: true, message: '请输入模型名称', trigger: 'blur' },
      ],
      apiKey: [
        { required: true, message: '请输入API Key', trigger: 'blur' },
      ],
      baseUrl: [
        { required: true, message: '请输入基础URL', trigger: 'blur' },
      ],
    }));

    const maskApiKey = (apiKey) => {
      return apiKey ? apiKey.replace(/.(?=.{4})/g, '*') : '';
    };

    watch(
        () => formState.apiKey,
        (newVal) => {
          maskedApiKey.value = maskApiKey(newVal);
        }
    );

    watch(
        () => props.initialValues,
        (newVal) => {
          if (newVal) {
            formState.modelName = newVal.modelName || '';
            formState.apiKey = newVal.apiKey || '';
            formState.useProxy = newVal.useProxy || false;
            formState.proxyHost = newVal.proxyHost || '';
            formState.proxyPort = newVal.proxyPort || null;
            formState.baseUrl = newVal.baseUrl || '';
            formState.model = newVal.model || '';
            formState.description = newVal.description || '';
            maskedApiKey.value = maskApiKey(formState.apiKey);
          }
        },
        { immediate: true }
    );

    const onSubmit = async () => {
      try {
        await formRef.value.validate();
        const data = { ...formState };

        if (!formState.useProxy) {
          delete data.proxyHost;
          delete data.proxyPort;
        }

        if (props.mode === 'add') {
          await post('/model/add', data);
        } else {
          data.modelId = props.initialValues.modelId;
          await post('/model/update', data);
        }

        emit('onCancel');
      } catch (error) {
        console.error('Validation failed or request error:', error);
      }
    };

    const onCancel = () => {
      emit('onCancel');
    };

    onMounted(() => {
      if (props.initialValues) {
        Object.assign(formState, props.initialValues);
        maskedApiKey.value = maskApiKey(formState.apiKey);
      }
    });

    return {
      formRef,
      formState,
      rules,
      onSubmit,
      onCancel,
      maskedApiKey,
    };
  },
};
</script>

<style scoped>
</style>
