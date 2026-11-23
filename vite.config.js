import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas que quase nunca mudam ficam em arquivos próprios: numa versão nova
        // do app o celular baixa só o código do ScaleMedic, não o React e o Supabase de novo.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
});