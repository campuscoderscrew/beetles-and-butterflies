function submitForm(event){
  event.preventDefault();
  const note=document.getElementById('form-note');
  note.textContent='Thank you! This form is currently a design preview. We will connect it to your business email when the site is published.';
  event.target.reset();
  return false;
}

document.querySelector('.menu-toggle').addEventListener('click',()=>{
  const nav=document.querySelector('nav');
  nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
  nav.style.flexDirection='column';
  nav.style.position='absolute';
  nav.style.top='74px';
  nav.style.right='5%';
  nav.style.background='#f7f0e4';
  nav.style.padding='20px';
  nav.style.borderRadius='16px';
  nav.style.boxShadow='0 12px 35px rgba(43,23,69,.18)';
});

document.querySelectorAll('.participant-card').forEach(card=>{
  card.addEventListener('click',()=>{
    const modal=document.getElementById('participant-modal');
    const comment=document.getElementById('participant-comment');
    comment.textContent=card.dataset.comment || 'Participant reflection coming soon.';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
  });
});

document.querySelectorAll('[data-close-modal]').forEach(el=>{
  el.addEventListener('click',()=>{
    const modal=document.getElementById('participant-modal');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
  });
});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const modal=document.getElementById('participant-modal');
    if(modal){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}
  }
});
