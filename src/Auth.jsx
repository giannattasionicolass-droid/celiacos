import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { LogIn, UserPlus, Mail, Lock, CreditCard, MapPin, Phone } from 'lucide-react';

const Auth = ({ setPagina }) => {
  const [loading, setLoading] = useState(false);
  const [esRegistro, setEsRegistro] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [cuit, setCuit] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (esRegistro) {
      // 1. Crear usuario en la Auth de Supabase
      const { data, error } = await supabase.auth.signUp({ email, password });
      
      if (error) alert(error.message);
      else {
        // 2. Guardar los datos extra en tu tabla 'perfiles'
        const { error: errorPerfil } = await supabase.from('perfiles').insert([
          { 
            id: data.user.id, 
            nombre, 
            apellido, 
            cuit, 
            direccion_envio: direccion, 
            telefono, 
            email 
          }
        ]);
        if (errorPerfil) alert("Error perfil: " + errorPerfil.message);
        else alert("¡Cuenta creada! Revisa tu email para confirmar.");
      }
    } else {
      // Logueo normal
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
      else setPagina('inicio');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto bg-white p-10 rounded-[40px] shadow-2xl border border-gray-100 animate-fadeIn mt-10">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-green-600">
          {esRegistro ? 'Crea tu Cuenta' : 'Bienvenido'}
        </h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">CeliaShop</p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-4 top-4 text-gray-400" size={18} />
          <input type="email" placeholder="EMAIL" className="w-full p-4 pl-12 bg-gray-50 rounded-2xl font-bold text-xs" onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="relative">
          <Lock className="absolute left-4 top-4 text-gray-400" size={18} />
          <input type="password" placeholder="CONTRASEÑA" className="w-full p-4 pl-12 bg-gray-50 rounded-2xl font-bold text-xs" onChange={e => setPassword(e.target.value)} required />
        </div>

        {esRegistro && (
          <div className="space-y-4 animate-fadeIn">
            <input type="text" placeholder="NOMBRE" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs" onChange={e => setNombre(e.target.value)} required />
            <input type="text" placeholder="APELLIDO" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs" onChange={e => setApellido(e.target.value)} required />
            <div className="relative">
              <CreditCard className="absolute left-4 top-4 text-gray-400" size={18} />
              <input type="text" placeholder="CUIT (SIN GUIONES)" className="w-full p-4 pl-12 bg-gray-50 rounded-2xl font-bold text-xs" onChange={e => setCuit(e.target.value)} required />
            </div>
            <input type="text" placeholder="DIRECCIÓN DE ENVÍO" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs" onChange={e => setDireccion(e.target.value)} required />
            <input type="text" placeholder="TELÉFONO" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs" onChange={e => setTelefono(e.target.value)} required />
          </div>
        )}

        <button disabled={loading} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-green-700 transition-all">
          {loading ? 'Cargando...' : esRegistro ? 'Registrarme' : 'Entrar'}
        </button>
      </form>

      <button onClick={() => setEsRegistro(!esRegistro)} className="w-full mt-6 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-green-600 transition-colors">
        {esRegistro ? '¿Ya tienes cuenta? Entra aquí' : '¿No tienes cuenta? Regístrate'}
      </button>
    </div>
  );
};

export default Auth;