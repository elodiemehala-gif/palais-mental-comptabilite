(() => {
  if (window.AndroidTTS && !('speechSynthesis' in window)) {
    class NativeSpeechSynthesisUtterance {
      constructor(text='') { this.text=text; this.lang='fr-FR'; this.rate=1; }
    }
    window.SpeechSynthesisUtterance = NativeSpeechSynthesisUtterance;
    window.speechSynthesis = {
      cancel(){ try{ window.AndroidTTS.cancel(); }catch{} },
      speak(u){ try{ window.AndroidTTS.speak(String(u?.text||''), Number(u?.rate||1)); }catch{} }
    };
  }

  if (window.AndroidSpeech && !window.SpeechRecognition && !window.webkitSpeechRecognition) {
    let seq=0;
    const pending=new Map();
    class NativeSpeechRecognition {
      constructor(){ this.lang='fr-FR'; this.onresult=null; this.onerror=null; this.onend=null; this._id=''; }
      start(){
        this._id='r'+(++seq);
        pending.set(this._id,this);
        try{ window.AndroidSpeech.start(this._id,this.lang||'fr-FR'); }
        catch(e){ this.onerror?.({error:'native-error',message:String(e)}); }
      }
      stop(){ try{ window.AndroidSpeech.stop(); }catch{} }
      abort(){ try{ window.AndroidSpeech.stop(); }catch{} }
    }
    window.SpeechRecognition=NativeSpeechRecognition;
    window.webkitSpeechRecognition=NativeSpeechRecognition;
    window.__pmNativeSpeechResult=(id,text)=>{
      const r=pending.get(id); if(!r)return;
      r.onresult?.({results:[[{transcript:String(text||'')}]]});
      r.onend?.(); pending.delete(id);
    };
    window.__pmNativeSpeechError=(id,message)=>{
      const r=pending.get(id); if(!r)return;
      r.onerror?.({error:'offline-unavailable',message:String(message||'')});
      r.onend?.(); pending.delete(id);
    };
  }
})();
