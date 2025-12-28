
import { GoogleGenAI, Type } from "@google/genai";
import { ShopInputs, WebsiteData } from "../types.ts";

/**
 * Generates an image using Gemini 2.5 Flash Image with retry logic.
 */
const generateImageWithRetry = async (ai: any, prompt: string, retries = 2): Promise<string | null> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData?.data) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    } catch (error) {
      console.warn(`Image generation failed for prompt: "${prompt}". Attempt ${i + 1}`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  return null;
};

export const generateContent = async (inputs: ShopInputs): Promise<WebsiteData> => {
  const apiKey = process.env.API_KEY;
  
  // Guard against missing API Key before SDK initialization
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY_MISSING");
  }

  // Create instance right before use
  const ai = new GoogleGenAI({ apiKey });

  // 1. Generate Text Content using Gemini 3 Flash
  const textResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate luxury barbershop website content for "${inputs.shopName}" in "${inputs.area}". 
    Phone: ${inputs.phone}.
    Tone: Premium, high-end, masculine, professional. 
    Hero heading MUST explicitly include both the shop name ("${inputs.shopName}") and the area ("${inputs.area}"). 
    Include: 
    1. A catchy hero heading and tagline.
    2. "About Us" section with 2 detailed paragraphs.
    3. Details for 4 services: Haircuts, Beard Styling, Traditional Shave, and Precision Fade.
    4. A professional email.
    5. A full address in ${inputs.area}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hero: {
            type: Type.OBJECT,
            properties: {
              heading: { type: Type.STRING },
              tagline: { type: Type.STRING },
            },
            required: ["heading", "tagline"],
          },
          about: {
            type: Type.OBJECT,
            properties: {
              heading: { type: Type.STRING },
              paragraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["heading", "paragraphs"],
          },
          services: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                subtitle: { type: Type.STRING },
              },
              required: ["title", "description", "subtitle"],
            },
          },
          contact: {
            type: Type.OBJECT,
            properties: {
              email: { type: Type.STRING },
              address: { type: Type.STRING },
            },
            required: ["email", "address"],
          }
        },
        required: ["hero", "about", "services", "contact"],
      }
    }
  });

  const content = JSON.parse(textResponse.text || '{}');

  // 2. Generate 8 Unique Images using Gemini 2.5 Flash Image
  const imagePrompts = [
    `Cinematic hero image of a barber in a luxury shop in ${inputs.area}, moody atmosphere, professional photography, 16:9`,
    `Styled interior of ${inputs.shopName}, leather vintage chairs, marble floors, soft lighting, 4:3`,
    `Close-up of premium gold-plated barber scissors and a silver straight razor, 1:1`,
    `A sharp skin fade haircut at ${inputs.shopName}, clean edges, 1:1`,
    `A barber applying warm lather with a silver brush, luxury ritual, 1:1`,
    `Modern masculine hair styling session at ${inputs.shopName}, dynamic movement, 1:1`,
    `Close-up of barber's hands using a straight razor for precision beard lineup, 1:1`,
    `Sophisticated entrance of ${inputs.shopName} in ${inputs.area}, architectural detail, 1:1`,
  ];

  const imageUrls: string[] = [];
  for (const prompt of imagePrompts) {
    const imgData = await generateImageWithRetry(ai, prompt);
    imageUrls.push(imgData || imageUrls[0] || "");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const serviceIcons: ('scissors' | 'razor' | 'mustache' | 'face')[] = ['scissors', 'razor', 'mustache', 'face'];

  return {
    shopName: inputs.shopName,
    area: inputs.area,
    phone: inputs.phone,
    hero: {
      heading: content.hero?.heading || `${inputs.shopName} in ${inputs.area}`,
      tagline: content.hero?.tagline || "Elite Grooming Standards",
      imageUrl: imageUrls[0],
    },
    about: {
      heading: content.about?.heading || "The Artisan Standard",
      description: content.about?.paragraphs || ["Dedicated to traditional craft and modern style."],
      imageUrl: imageUrls[1],
    },
    services: (content.services || []).map((s: any, i: number) => ({
      ...s,
      icon: serviceIcons[i % 4],
      imageUrl: imageUrls[i + 2] || imageUrls[2],
    })),
    gallery: imageUrls.slice(0, 8),
    contact: content.contact || { 
      address: inputs.area, 
      email: `contact@${inputs.shopName.toLowerCase().replace(/\s/g, '')}.com` 
    },
  };
};
