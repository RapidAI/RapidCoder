import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import Antd from 'ant-design-vue';
import { createPinia } from 'pinia';
import piniaPluginPersist from 'pinia-plugin-persist';
import './assets/global.css';
import 'virtual:svg-icons-register';
const pinia = createPinia().use(piniaPluginPersist);
createApp(App)
  .use(router)
  .use(pinia)
  .use(Antd)
  .mount('#app');