const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const app = express();
 
const upload = multer({ storage: multer.memoryStorage() });
 
// Config
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_DESTINATAIRE = process.env.EMAIL_DESTINATAIRE || 'gaspar@dromlag.com';
const EMAIL_RECEPTION = process.env.EMAIL_RECEPTION || 'reception@example.com'; // ← à remplacer dans Railway
const EMAIL_EXPEDITEUR = process.env.EMAIL_EXPEDITEUR || 'chaussegaspar@gmail.com';
 
app.use(express.static('public'));
 
app.post('/envoyer', upload.array('fichiers', 20), async (req, res) => {
  try {
    const { role, nom, chantier, commentaires, typeRapport } = req.body;
    const fichiers = req.files || [];
    const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    const estReception = typeRapport === 'reception';
 
    // Pièces jointes (images + PDF)
    const attachments = fichiers.map((file, i) => ({
      name: file.originalname || `fichier_${i + 1}`,
      content: file.buffer.toString('base64'),
      type: file.mimetype,
    }));
 
    // Commentaires photos
    let commentairesTexte = '';
    if (commentaires) {
      const comms = Array.isArray(commentaires) ? commentaires : [commentaires];
      comms.forEach((c, i) => {
        if (c) commentairesTexte += `Photo ${i + 1} : ${c}\n`;
      });
    }
 
    // Corps du mail
    const emailBody = estReception
      ? `
RÉCEPTION DE CHANTIER
=====================
Date : ${now}
Réceptionné par : ${nom} (${role})
Chantier : ${chantier}
${fichiers.length} fichier(s) joint(s) (photos + PV de réception)
${commentairesTexte ? `COMMENTAIRES :\n${commentairesTexte}` : ''}
---
Rapport envoyé automatiquement depuis l'application terrain.
      `.trim()
      : `
RAPPORT TERRAIN
===============
Date : ${now}
Envoyé par : ${nom} (${role})
Chantier / Client : ${chantier}
${fichiers.length} photo(s) jointe(s)
${commentairesTexte ? `COMMENTAIRES :\n${commentairesTexte}` : ''}
---
Rapport envoyé automatiquement depuis l'application terrain.
      `.trim();
 
    const sujet = estReception
      ? `Réception chantier — ${chantier} — ${nom}`
      : `Rapport terrain — ${chantier} — ${nom}`;
 
    // Destinataire selon le type de rapport
    const destinataire = estReception ? EMAIL_RECEPTION : EMAIL_DESTINATAIRE;
 
    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: `${nom} (terrain)`, email: EMAIL_EXPEDITEUR },
      to: [{ email: destinataire }],
      subject: sujet,
      textContent: emailBody,
      attachment: attachments,
    }, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      }
    });
 
    res.json({ success: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
