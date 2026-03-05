const axios = require('axios');
const xml2js = require('xml2js');

module.exports = async (req, res) => {
  try {
    // 1. Stáhnout původní XML
    const response = await axios.get('https://www.dops.cz/editor/filestore/io_folder/luigisbox.xml');
    const parser = new xml2js.Parser({ explicitArray: true });
    const result = await parser.parseStringPromise(response.data);
    const shopItems = result.SHOP.SHOPITEM;
    
    // 2. Extrahovat všechny kategorie a rozložit je na jednotlivé úrovně
    const categoryHierarchies = new Set();
    
    shopItems.forEach(item => {
      let categories = item.CATEGORYTEXT || [];
      let bestCategory = categories.length > 0 ? categories.sort((a, b) => b.length - a.length)[0] : "Ostatní";
      if (!bestCategory || bestCategory.trim() === "" || bestCategory.trim() === ";") {
        bestCategory = "Ostatní";
      }
      
      const categoryParts = bestCategory
        .split('|')
        .map(part => part.trim())
        .filter(part => part !== '');
      
      // Přidat všechny úrovně hierarchie
      // Např. "A | B | C" vytvoří: "A", "A | B", "A | B | C"
      for (let i = 0; i < categoryParts.length; i++) {
        const path = categoryParts.slice(0, i + 1).join(' | ');
        categoryHierarchies.add(path);
      }
    });
    
    // 3. Vytvořit category elementy s hierarchy podle Luigi's Box formátu
    const categoryElements = Array.from(categoryHierarchies).map((fullPath) => {
      const parts = fullPath.split(' | ').map(p => p.trim());
      const categoryTitle = parts[parts.length - 1]; // Poslední část = title
      const hierarchy = parts.length > 1 ? parts.slice(0, -1).join(' | ') : null; // Cesta K této kategorii (bez ní)
      
      // URL slug z poslední části
      const categorySlug = categoryTitle
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      // ID z celé cesty
      const categoryId = fullPath
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s*\|\s*/g, '-')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      const categoryObj = {
        identity: categoryId,
        title: categoryTitle,
        web_url: `https://www.dops.cz/${categorySlug}`
      };
      
      // Přidat hierarchy pouze pokud není top-level (podle Luigi's Box dokumentace)
      if (hierarchy) {
        categoryObj.hierarchy = hierarchy;
      }
      
      return categoryObj;
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
