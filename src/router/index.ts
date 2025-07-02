import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: App,
    props: (route: any) => ({ selectedNoteKey: route.query.note || null })
  },
  {
    path: '/note/:key',
    name: 'Note',
    component: App,
    props: (route: any) => ({ selectedNoteKey: route.params.key })
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router 