<template>
  <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 14 }"
  >
    <a-form-item label="用户名" name="username">
      <a-input v-model:value="formState.username" placeholder="请输入用户名"/>
    </a-form-item>

    <a-form-item label="邮箱" name="email">
      <a-input v-model:value="formState.email" placeholder="请输入邮箱地址"/>
    </a-form-item>

    <a-form-item label="头像" name="avatar">
      <a-input v-model:value="formState.avatar" placeholder="请输入头像URL"/>
    </a-form-item>

    <a-form-item label="密码" name="password" v-if="mode === 'add' || showPassword">
      <a-input v-model:value="formState.password" placeholder="请输入新密码"/>
    </a-form-item>

    <a-form-item v-if="mode !== 'add'" :wrapper-col="{ span: 20, offset: 6 }">
      <a-button type="default" @click="togglePasswordField">
        {{ showPassword ? '取消重置密码' : '重置密码' }}
      </a-button>
    </a-form-item>

    <a-form-item :wrapper-col="{ span: 20, offset: 6 }">
      <a-button type="primary" @click="onSubmit">确认</a-button>
      <a-button style="margin-left: 10px" @click="onCancel">取消</a-button>
    </a-form-item>
  </a-form>
</template>

<script>
import {ref, reactive, computed, watch, onMounted} from 'vue';
import {post} from '@/api';

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
  setup(props, {emit}) {
    const formRef = ref(null);
    const formState = reactive({
      username: '',
      email: '',
      avatar: '',
      password: '',
    });

    const showPassword = ref(false);

    const togglePasswordField = () => {
      showPassword.value = !showPassword.value;
      if (!showPassword.value) {
        formState.password = '';
      }
    };

    const rules = computed(() => ({
      username: [
        {required: true, message: '请输入用户名', trigger: 'blur'},
        {min: 2, max: 15, message: '用户名长度应为2到15个字符', trigger: 'blur'},
      ],
      email: [
        {required: true, message: '请输入邮箱地址', trigger: 'blur'},
        {type: 'email', message: '邮箱格式不正确', trigger: 'blur'},
      ],
      avatar: [
        {required: false, message: '请输入头像URL', trigger: 'blur'},
      ],
      password: [
        {required: props.mode === 'add' || showPassword.value, message: '请输入新密码', trigger: 'blur', min: 6},
      ],
    }));

    watch(
        () => props.initialValues,
        (newVal) => {
          formState.username = newVal.username || '';
          formState.email = newVal.email || '';
          formState.avatar = newVal.avatar || '';
        },
        {immediate: true}
    );

    const onSubmit = async () => {
      try {
        await formRef.value.validate();
        const data = {
          username: formState.username,
          email: formState.email,
          avatar: formState.avatar,
        };

        if (formState.password || props.mode === 'add') {
          data.password = formState.password;
        }

        if (props.mode === 'add') {
          await post('/users/add', data);
        } else {
          data.userId = props.initialValues.userId;
          await post('/users/update', data);
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
        formState.username = props.initialValues.username || '';
        formState.email = props.initialValues.email || '';
        formState.avatar = props.initialValues.avatar || '';
      }
    });

    return {
      formRef,
      formState,
      rules,
      onSubmit,
      onCancel,
      showPassword,
      togglePasswordField,
    };
  },
};
</script>

<style scoped>
</style>
