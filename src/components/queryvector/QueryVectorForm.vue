<template>
  <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 14 }"
  >
    <a-form-item label="查询文本" name="queryText">
      <a-input v-model:value="formState.queryText" placeholder="请输入查询文本"/>
    </a-form-item>

    <a-form-item label="查询结果" name="resultText">
      <a-textarea v-model:value="formState.resultText" placeholder="请输入查询结果"/>
    </a-form-item>

    <a-form-item label="状态" name="success">
      <a-switch v-model:checked="formState.success"/>
    </a-form-item>

    <a-form-item :wrapper-col="{ span: 20, offset: 6 }">
      <a-button type="primary" @click="onSubmit">确认</a-button>
      <a-button style="margin-left: 10px" @click="onCancel">取消</a-button>
    </a-form-item>
  </a-form>
</template>

<script>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { post } from '@/api/index.js';

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
  emits: ['onCancel'], // 声明 onCancel 事件
  setup(props, { emit }) {
    const formRef = ref(null);
    const formState = reactive({
      queryText: '',
      resultText: '',
      success: false,
    });

    const rules = computed(() => ({
      queryText: [
        { required: true, message: '请输入查询文本', trigger: 'blur' },
      ],
      resultText: [
        { required: true, message: '请输入查询结果', trigger: 'blur' },
      ],
    }));

    watch(
        () => props.initialValues,
        (newVal) => {
          if (newVal) {
            formState.queryText = newVal.queryText || '';
            formState.resultText = newVal.resultText || '';
            formState.success = newVal.success || false;
          }
        },
        { immediate: true }
    );

    const onSubmit = async () => {
      try {
        await formRef.value.validate();
        const data = { ...formState };

        if (props.mode === 'add') {
          await post('/queryVectors/add', data);
        } else {
          data.queryVectorId = props.initialValues.queryVectorId;
          await post('/queryVectors/update', data);
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
      }
    });

    return {
      formRef,
      formState,
      rules,
      onSubmit,
      onCancel,
    };
  },
};
</script>

<style scoped>
</style>

