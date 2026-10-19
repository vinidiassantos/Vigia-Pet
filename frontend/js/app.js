import { analisarComportamentoPet } from './gemini-service.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('gemini-form');
  const promptInput = document.getElementById('prompt-input');
  const mediaInput = document.getElementById('media-input');
  const btnSubmit = document.getElementById('vigiarBtn');
  const btnText = document.getElementById('btn-text');
  const iaList = document.getElementById('iaList');
  const resultContainer = document.getElementById('result-container');
  const resultContent = document.getElementById('result-content');
  const behaviorText = document.getElementById('behaviorText');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const promptText = promptInput ? promptInput.value.trim() : '';
    const mediaFile = (media