import {createRouter, createWebHistory} from 'vue-router';
import Login from '../components/auth/Login.vue';
import Register from '../components/auth/Register.vue';
import NotFound from '../components/common/NotFound.vue';
import UserTable from '../components/user/UserTable.vue';
import SessionWithBigData from '../components/session/SessionWithBigData.vue';
import QueryVectorTable from '../components/queryvector/QueryVectorTable.vue';
import MySettings from '../components/settings/MySettings.vue';
import ProjectTable from '../components/project/ProjectTable.vue';
import ModelTable from '../components/model/ModelTable.vue';

const routes = [
    {
        path: '/Login',
        name: 'Login',
        component: Login
    },
    {
        path: '/Register',
        name: 'Register',
        component: Register
    },
    {
        path: '/',
        redirect: '/SessionWithBigData'
    },
    {
        path: '/User',
        name: 'User',
        component: UserTable
    },
    {
        path: '/SessionWithBigData',
        name: 'SessionWithBigData',
        component: SessionWithBigData
    },
    {
        path: '/QueryVector',
        name: 'QueryVector',
        component: QueryVectorTable
    },
    {
        path: '/MySettings',
        name: 'MySettings',
        component: MySettings
    },
    {
        path: '/ModelTable',
        name: 'ModelTable',
        component: ModelTable
    },
    {
        path: '/ProjectTable',
        name: 'ProjectTable',
        component: ProjectTable
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: NotFound
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router;