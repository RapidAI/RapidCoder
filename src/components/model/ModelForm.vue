<template>
  <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 14 }"
  >
    <a-form-item label="模型名称" name="model">
      <a-input v-model:value="formState.model" placeholder="请输入模型名称"/>
    </a-form-item>

    <a-form-item label="API Key" name="apiKey">
      <a-input v-model:value="formState.apiKey" placeholder="请输入API Key" style="width: 400px"/>
    </a-form-item>

    <a-form-item label="使用代理" name="useProxy">
      <a-switch v-model:checked="formState.useProxy"/>
    </a-form-item>

    <a-form-item v-if="formState.useProxy" label="代理主机" name="proxyHost">
      <a-input v-model:value="formState.proxyHost" placeholder="请输入代理主机地址"/>
    </a-form-item>

    <a-form-item v-if="formState.useProxy" label="代理端口" name="proxyPort">
      <a-input-number v-model:value="formState.proxyPort" placeholder="请输入代理端口"/>
    </a-form-item>

    <a-form-item label="基础URL" name="baseUrl">
      <a-input v-model:value="formState.baseUrl" placeholder="请输入基础URL"/>
    </a-form-item>

    <a-form-item :wrapper-col="{ span: 20, offset: 6 }">
      <a-button type="text" @click="onSubmit">确认</a-button>
      <a-button style="margin-left: 10px" @click="onCancel">取消</a-button>
    </a-form-item>
  </a-form>
</template>

<script>
import {ref, reactive, computed, watch, onMounted} from 'vue';
import {useModelStore} from '@/store/ModelStore';

export default {
  props: {
    initialValues: {type: Object, default: () => ({})},
    mode: {type: String, default: 'add'},
  },
  setup(props, {emit}) {
    const modelStore = useModelStore();
    const formRef = ref(null);
    const formState = reactive({
      apiKey: '',
      useProxy: false,
      proxyHost: '',
      proxyPort: null,
      baseUrl: '',
      model: '',
    });

    const rules = computed(() => ({
      model: [{required: true, message: '请输入模型名称', trigger: 'blur'}],
      apiKey: [{required: true, message: '请输入API Key', trigger: 'blur'}],
      baseUrl: [{required: true, message: '请输入基础URL', trigger: 'blur'}],
    }));

    const maskApiKey = (apiKey) => apiKey.replace(/.(?=.{4})/g, '*');

    watch(() => props.initialValues, (newVal) => {
      Object.assign(formState, newVal || {});
      formState.apiKey = newVal.apiKey || '';
    }, {immediate: true});

    const onSubmit = async () => {
      await formRef.value.validate();
      const data = {...formState};
      if (!data.useProxy) delete data.proxyHost, delete data.proxyPort;
      if (props.mode === 'add') {
        modelStore.addModel(data);
      } else {
        const index = modelStore.models.findIndex(model => model.modelId === props.initialValues.modelId);
        if (index !== -1) {
          modelStore.models[index] = {...data, modelId: props.initialValues.modelId};
        }
      }
      emit('onCancel');
    };

    const onCancel = () => emit('onCancel');

    onMounted(() => Object.assign(formState, props.initialValues));

    return {formRef, formState, rules, onSubmit, onCancel};
  },
};
</script>
