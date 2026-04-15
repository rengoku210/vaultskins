import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import './Goodbye.css';

export default function Goodbye() {
  return (
    <div className="goodbye-page">
      <div className="goodbye-content">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="goodbye-icon"
        >
          👋
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Thank you for visiting VaultSkins
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          We respect your decision regarding our platform policies. 
          Without accepting our Terms & Conditions, you cannot access or trade on the marketplace.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="goodbye-actions"
        >
          <Link to="/" className="btn btn-ghost">Return to Main Page</Link>
        </motion.div>
      </div>
      
      <div className="goodbye-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>
    </div>
  );
}
