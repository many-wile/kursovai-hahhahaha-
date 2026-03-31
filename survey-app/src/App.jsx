import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  return (
    <div style={{backgroundColor: '#121212', color: 'white', minHeight: '100vh'}}>
      <header style={{padding: '16px', fontWeight: 'bold', fontSize: '28px', borderBottom: '1px solid #2a2a2a'}}>
        GARI.OPROS
        </header>
        <main style={{ padding: '36px', maxWidth: '1200px', margin: '0 auto' }}>\
          <section style={{ marginBottom: '48px', backGroundC: '#2a4g3y', padding: '24px', borderRadius: '12px', minHeight: '220px' }}>
          <h1 style={{fontSize: '28px', marginBottom: '8px'}}>
            Добро пожаловать в опросник GARIBOS теперь вы наш босс!!!
             </h1>
             <p style={{color: '#sdwyu18'}}>
              Опросник для определения вашего уровня GARIBOS
            </p>
          </section>
        </main>
    </div>
    );
 }
 export default App;
       
