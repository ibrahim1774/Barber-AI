
import { GoogleGenAI, Type } from "@google/genai";
import { ShopInputs, WebsiteData } from "../types";

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
        // Wait longer between retries to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  return null;
};

export const generateContent = async (inputs: ShopInputs): Promise<WebsiteData> => {
  // Always create a new instance right before making an API call to ensure it uses the latest key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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
  // We specify aspect ratios in the prompt and config to match website sections
  const imagePrompts = [
    `Cinematic, high-end hero image of a master barber in a luxury shop in ${inputs.area}, moody atmosphere, professional photography, dark wood and gold accents, 16:9`,
    `Elegantly styled interior of a boutique barbershop called ${inputs.shopName}, leather vintage chairs, marble floors, soft warm lighting, 4:3`,
    `Close-up of premium gold-plated barber scissors and a silver straight razor on a clean marble surface, high luxury grooming tools, 1:1`,
    `A sharp, professional skin fade haircut on a client at ${inputs.shopName}, clean edges, detailed texture, professional salon shot, 1:1`,
    `A master barber applying warm lather to a client with a silver shaving brush, luxury grooming ritual, 1:1`,
    `Modern masculine hair styling session at ${inputs.shopName}, dynamic movement, luxury products, artistic lighting, 1:1`,
    `Artistic close-up of a barber's hands using a straight razor for a precise beard lineup, high contrast, professional focus, 1:1`,
    `The sophisticated entrance of ${inputs.shopName} in ${inputs.area}, architectural detail, premium brand logo on black window, 1:1`,
  ];

  const imageUrls: string[] = [];
  
  // Sequential generation with delay to ensure all images are unique and high-quality
  for (const prompt of imagePrompts) {
    const imgData = await generateImageWithRetry(ai, prompt);
    if (imgData) {
      imageUrls.push(imgData);
    } else {
      // If generation fails completely after retries, we use the first successful image as a placeholder 
      // instead of a broken icon or external link, but we aim for 8 unique ones.
      imageUrls.push(imageUrls[0] || "");
    }
    // Respect rate limits for image generation
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  const serviceIcons: ('scissors' | 'razor' | 'mustache' | 'face')[] = ['scissors', 'razor', 'mustache', 'face'];

  return {
    shopName: inputs.shopName,
    area: inputs.area,
    phone: inputs.phone,
    hero: {
      heading: content.hero?.heading || `${inputs.shopName}: Premium Grooming in ${inputs.area}`,
      tagline: content.hero?.tagline || "Experience the Ultimate Sharp Look",
      imageUrl: imageUrls[0],
    },
    about: {
      heading: content.about?.heading || "Crafting Excellence",
      description: content.about?.paragraphs || ["Our shop is dedicated to the art of traditional barbering and modern style."],
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
