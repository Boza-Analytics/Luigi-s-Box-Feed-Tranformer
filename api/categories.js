const axios = require('axios');
const xml2js = require('xml2js');

module.exports = async (req, res) => {
  try {
    // 1. Stáhnout původní XML
    const response = await axios.get('https://www.dops.cz/editor/filestore/io_folder/luigisbox.xml');
    const parser = new xml2js.Parser({ explicitArray: true });
    const result = await parser.parseStringPromise(response.data);
    const shopItems = result.SHOP.SHOPITEM;
    
    // 2. Extrahovat všechny unikátní kategorie
    const categorySet = new Set();
    
    shopItems.forEach(item => {
      let categories = item.CATEGORYTEXT || [];
      let bestCategory = categories.length > 0 ? categories.sort((a, b) => b.length - a.length)[0] : "Ostatní";
      if (!bestCategory || bestCategory.trim() === "" || bestCategory.trim() === ";") {
        bestCategory = "Ostatní";
      }
      
      // Normalizovat kategorie s mezerami kolem |
      const normalizedCategory = bestCategory
        .split('|')
        .map(part => part.trim())
        .filter(part => part !== '')
        .join(' | ');
      
      categorySet.add(normalizedCategory);
    });
    
    // 3. Vytvořit category elementy
    const categoryElements = Array.from(categorySet).map((cat, index) => {
      // Rozdělit kategorii podle | a vzít pouze poslední část
      const categoryParts = cat.split('|').map(part => part.trim()).filter(part => part !== '');
      const lastCategory = categoryParts.length > 0 ? categoryParts[categoryParts.length - 1] : cat;
      
      // Vytvoříme URL slug z poslední části kategorie
      const categorySlug = lastCategory
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Vytvoříme ID z celé kategorie (pro jedinečnost)
      const categoryId = cat
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s*\|\s*/g, '-')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      return {
        identity: categoryId || `category-${index + 1}`,
        title: cat,
        web_url: `https://www.dops.cz/${categorySlug || `category-${index + 1}`}`
      };
    });
    
    // 4. Sestavení XML pro kategorie
    const builder = new xml2js.Builder({
      rootName: 'categories',
      cdata: true,
      xmldec: { version: '1.0', encoding: 'UTF-8' }
    });
    const finalXml = builder.buildObject({ category: categoryElements });
    
    // 5. Odeslání odpovědi
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(finalXml);
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error transforming category feed');
  }
};
