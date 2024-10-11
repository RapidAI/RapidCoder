import {createRouter, createWebHistory} from 'vue-router';
import NotFound from '../components/common/NotFound.vue';
import Session from '../components/session/Session.vue';
import ModelTable from '../components/model/ModelTable.vue';

const routes = [
    {
        path: '/',
        redirect: '/Session'
    },
    {
        path: '/Session',
        name: 'Session',
        component: Session
    },
    {
        path: '/ModelTable',
        name: 'ModelTable',
        component: ModelTable
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