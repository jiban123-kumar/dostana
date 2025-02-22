const { supabase } = require("./supabaseConfig");
const removeFileFromSupabase = async (filePath) => {
  try {
    const { error } = await supabase.storage.from("dostana").remove([filePath]);
    if (error) throw error;
    return { isError: false };
  } catch (error) {
    console.log(error);
    return { isError: true };
  }
};
module.exports = {
  removeFileFromSupabase,
};
