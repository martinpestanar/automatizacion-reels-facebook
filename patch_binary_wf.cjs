const fs = require('fs');

const wf = JSON.parse(fs.readFileSync('C:/Users/Martin/.gemini/antigravity/brain/b9d2deba-0506-4aeb-8fc5-60a343efd924/updated_workflow.json', 'utf8'));

// 1. HTTP Request node to download the MP4 from Supabase into binary
const downloadVideoNode = {
  parameters: {
    url: "={{ $json.body?.final_video_url || $json.final_video_url }}",
    responseFormat: "file",
    options: {}
  },
  id: "download_video_binary",
  name: "Descargar_Video_Binary",
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position: [-544, 272]
};

// 2. Adjust Facebook_Publicar_Video to upload binary data directly
const fbVideoNode = wf.nodes.find(n => n.name === 'Facebook_Publicar_Video');
fbVideoNode.position = [-344, 272];
fbVideoNode.parameters = {
  edge: "videos",
  graphApiVersion: "v23.0",
  httpRequestMethod: "POST",
  node: "me",
  sendBinaryData: true,
  binaryPropertyName: "data",
  options: {
    queryParameters: {
      parameter: [
        {
          name: "description",
          value: "={{ $('Trigger_Webhook_Inmediato').item?.json?.body?.copy_text || $('Consultar_Videos_Supabase').item?.json?.copy_text || $('Trigger_Webhook_Inmediato').item?.json?.copy_text || '' }}"
        }
      ]
    }
  }
};

// Filter out old download node if present, then add new one
wf.nodes = wf.nodes.filter(n => n.name !== 'Descargar_Video_Binary');
wf.nodes.push(downloadVideoNode);

// Rewire connections
wf.connections['Es_Historia_Independiente'].main[1] = [
  { node: 'Descargar_Video_Binary', type: 'main', index: 0 }
];
if (wf.connections['Consultar_Videos_Supabase']) {
  wf.connections['Consultar_Videos_Supabase'].main[0] = [
    { node: 'Descargar_Video_Binary', type: 'main', index: 0 }
  ];
}
wf.connections['Descargar_Video_Binary'] = {
  main: [
    [
      { node: 'Facebook_Publicar_Video', type: 'main', index: 0 }
    ]
  ]
};

fs.writeFileSync('C:/Users/Martin/.gemini/antigravity/brain/b9d2deba-0506-4aeb-8fc5-60a343efd924/updated_workflow_binary.json', JSON.stringify(wf, null, 2));
console.log('Saved updated_workflow_binary.json clean!');
