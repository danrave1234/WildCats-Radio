import React, { useState } from 'react';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(null); // 'success' | 'error'

  const mailToAddress = 'wildcatsradio@example.edu'; // TODO: replace with official inbox

  const isValidEmail = (value) => /[^@\s]+@[^@\s]+\.[^@\s]+/.test(value);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !isValidEmail(email) || !message.trim()) {
      setStatus({ type: 'error', text: 'Please fill out all fields with a valid email.' });
      return;
    }

    const subject = encodeURIComponent(`[WildCats Radio] Message from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:${mailToAddress}?subject=${subject}&body=${body}`;
    setStatus({ type: 'success', text: 'Your email client should open. If not, email us directly.' });
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-yellow-400 mb-4">Contact</h1>
      <p className="text-white/80 mb-2">Have questions or feedback? Reach out below.</p>
      <p className="text-white/60 mb-6">Email: <a href={`mailto:${mailToAddress}`} className="text-yellow-300 hover:underline">{mailToAddress}</a></p>
      {status && (
        <div className={`${status.type === 'success' ? 'bg-green-600/20 border-green-600 text-green-300' : 'bg-red-600/20 border-red-600 text-red-300'} border px-3 py-2 rounded mb-4`}>
          {status.text}
        </div>
      )}
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="block text-sm text-white/70 mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md bg-gray-800 text-white border border-gray-700 px-3 py-2" placeholder="Your name" required />
        </div>
        <div>
          <label className="block text-sm text-white/70 mb-1">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-md bg-gray-800 text-white border border-gray-700 px-3 py-2" placeholder="you@example.com" required />
          {!email || isValidEmail(email) ? null : (
            <p className="text-xs text-red-300 mt-1">Enter a valid email.</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-white/70 mb-1">Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="w-full rounded-md bg-gray-800 text-white border border-gray-700 px-3 py-2" placeholder="How can we help?" required />
        </div>
        <button type="submit" className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-md">Send</button>
      </form>
    </div>
  );
}


